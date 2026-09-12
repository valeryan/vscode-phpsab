import path from 'node:path';
import { WorkspaceConfiguration } from 'vscode';
import { ResourceSettings } from '../interfaces/settings';
import { logger } from '../logger';
import { createPathResolver } from './path-resolver';
import {
  executableExists,
  expandHomeDir,
  joinPaths,
  normalizePath,
} from './path-resolver-utils';

/**
 * Resolve the correct PHPCBF executable path.
 * @param {ResourceSettings} settings The resource settings.
 * @returns {Promise<ResourceSettings>} The resolved resource settings with the correct executable path.
 */
export const resolveCBFExecutablePath = async (
  settings: ResourceSettings,
): Promise<ResourceSettings> => {
  // If no path is set, try and find it via the path resolver.
  if (!settings.executablePathCBF) {
    let executablePathResolver = createPathResolver(settings, 'phpcbf');
    settings.executablePathCBF = await executablePathResolver.resolve();
  } else {
    settings.executablePathCBF = expandHomeDir(settings.executablePathCBF);

    // If a relative path is set, resolve it against the workspace root.
    if (
      !path.isAbsolute(settings.executablePathCBF) &&
      settings.workspaceRoot !== null
    ) {
      settings.executablePathCBF = joinPaths(
        settings.workspaceRoot,
        settings.executablePathCBF,
      );
    }
    // Otherwise normalize the absolute path.
    else {
      settings.executablePathCBF = normalizePath(settings.executablePathCBF);
    }
  }

  return settings;
};

/**
 * Resolve the correct PHPCS executable path.
 * @param {ResourceSettings} settings The resource settings.
 * @returns {Promise<ResourceSettings>} The resolved resource settings with the correct executable path.
 */
export const resolveCSExecutablePath = async (
  settings: ResourceSettings,
): Promise<ResourceSettings> => {
  // If no path is set, try and find it via the path resolver.
  if (!settings.executablePathCS) {
    let executablePathResolver = createPathResolver(settings, 'phpcs');
    settings.executablePathCS = await executablePathResolver.resolve();
  } else {
    settings.executablePathCS = expandHomeDir(settings.executablePathCS);

    // If a relative path is set, resolve it against the workspace root.
    if (
      !path.isAbsolute(settings.executablePathCS) &&
      settings.workspaceRoot !== null
    ) {
      settings.executablePathCS = joinPaths(
        settings.workspaceRoot,
        settings.executablePathCS,
      );
    }
    // Otherwise normalize the absolute path.
    else {
      settings.executablePathCS = normalizePath(settings.executablePathCS);
    }
  }

  return settings;
};

/**
 * Resolve PHP executable path with proper precedence handling
 * @param {WorkspaceConfiguration} config phpsab configuration
 * @param {WorkspaceConfiguration} phpConfig php configuration
 * @returns {Promise<string>} The resolved PHP executable path or an empty string if none is found.
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

  for (const source of phpExecutableSources) {
    const expandedPath = source.path ? expandHomeDir(source.path) : source.path;
    // Return the first valid (non-empty) existing executable path found
    if (expandedPath && (await executableExists(expandedPath))) {
      logger.debug(`Using PHP executable from ${source.name}: ${expandedPath}`);
      return expandedPath;
    }
  }

  // If no executable path is found, return an empty string
  return '';
};
