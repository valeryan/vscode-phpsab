import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkspaceConfiguration } from 'vscode';
import { ToolExecutable } from '../interfaces/common';
import { ConsoleError } from '../interfaces/console-error';
import {
  executableSettingKeys,
  ResourceSettings,
} from '../interfaces/settings';
import { logger } from '../logger';
import { createPathResolver } from './path-resolver';
import {
  executableExists,
  expandHomeDir,
  isWin,
  normalizePath,
} from './path-resolver-utils';

/**
 * Resolve the correct phpcs/phpcbf executable path, either by auto-detection
 * (when setting is not configured) or by expanding and normalizing the configured path.
 * @param {ResourceSettings} settings The resource settings.
 * @param {ToolExecutable} executable The executable to resolve, either `'phpcs'` or `'phpcbf'`.
 * Its matching `executablePathCS`/`executablePathCBF` setting is read and updated.
 * @returns {Promise<ResourceSettings>} The resolved resource settings with the correct executable path.
 */
export const resolveExecutablePath = async (
  settings: ResourceSettings,
  executable: ToolExecutable,
): Promise<ResourceSettings> => {
  const key = executableSettingKeys[executable];
  const configured = settings[key];

  // If no path is set, try and find it via the path resolver.
  if (!configured) {
    try {
      settings[key] = await createPathResolver(settings, executable).resolve();
    } catch (err) {
      const error: ConsoleError = err as ConsoleError;

      logger.error(
        `Failed to resolve ${executable.toUpperCase()} executable path: ${error.message}\n${error.stack}`,
      );
    }
    return settings;
  }

  const expanded = expandHomeDir(configured);

  // If a relative path is set, resolve it against the workspace root.
  // Otherwise normalize the absolute path.
  settings[key] =
    !path.isAbsolute(expanded) && settings.workspaceRoot !== null
      ? path.join(settings.workspaceRoot, expanded)
      : normalizePath(expanded);

  return settings;
};

/**
 * Resolve PHP executable path with proper precedence handling.
 * Supports both direct executable file paths and directory paths.
 *
 * @param {WorkspaceConfiguration} config phpsab configuration
 * @param {WorkspaceConfiguration} phpConfig php configuration
 * @returns {Promise<string>} The resolved PHP directory path or an empty string if none is found.
 */
export const resolvePhpExecutablePath = async (
  config: WorkspaceConfiguration,
  phpConfig: WorkspaceConfiguration,
): Promise<string> => {
  const phpExecutableSources = [
    {
      name: 'VSCode PHP Language Features Built-in Extension',
      path: phpConfig.get<string>('validate.executablePath', ''),
    },
    {
      name: 'Devsense PHP Tools Extension',
      path: phpConfig.get<string>('executablePath', ''),
    },
    {
      name: 'PHPSAB Extension',
      path: config.get<string>('phpExecutablePath', ''),
    },
  ];

  const phpBinary = isWin() ? 'php.exe' : 'php';

  for (const source of phpExecutableSources) {
    // Skip empty or null paths
    if (!source.path || source.path === 'null') {
      continue;
    }

    const expandedPath = expandHomeDir(source.path);

    try {
      const stat = await fs.stat(expandedPath);
      let resolvedDir: string | null = null;

      // Attempt to determine if the path is a directory or a file and handle accordingly.

      // Case A: directory path (e.g. "C:\php\8.2" or "/usr/local/bin").
      if (stat.isDirectory()) {
        // Construct the full path to the PHP binary within the directory.
        const binaryPath = path.join(expandedPath, phpBinary);
        // Check if the PHP binary exists within the directory.
        if (await executableExists(binaryPath)) {
          resolvedDir = expandedPath;
        }
      }
      // Case B: executable file path (e.g. "C:\php\8.2\php.exe" or "/usr/bin/php").
      else if (stat.isFile() && (await executableExists(expandedPath))) {
        // Get the directory containing the PHP executable (e.g. "C:\php\8.2" or "/usr/local/bin").
        resolvedDir = path.dirname(expandedPath);
      }

      // If a valid PHP directory was resolved, log it and return the normalized path.
      if (resolvedDir) {
        const normalizedPath = normalizePath(resolvedDir);
        logger.debug(
          `Using PHP directory from ${source.name}: ${normalizedPath}`,
        );
        return normalizedPath;
      }
    } catch {
      // Path does not exist on disk, try the next source
      continue;
    }
  }

  // If no executable path is found, return an empty string
  return '';
};
