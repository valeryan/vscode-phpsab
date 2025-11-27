import fs from 'node:fs/promises';
import { TextDocument, workspace } from 'vscode';
import { PathResolver } from '../interfaces/path-resolver';
import { ResourceSettings } from '../interfaces/resource-settings';
import { logger } from '../logger';
import { isSingleFileMode } from '../settings';
import {
  getPlatformExtension,
  getPlatformPathSeparator,
  normalizePath,
} from './path-resolver-utils';

export const createStandardsPathResolver = (
  document: TextDocument,
  config: ResourceSettings,
): PathResolver => {
  const extension = getPlatformExtension();
  const pathSeparator = getPlatformPathSeparator();
  return {
    extension,
    pathSeparator,
    resolve: async () => {
      let configured = normalizePath(config.standard ?? '');

      if (!isStandardValid(configured, config.allowedAutoRulesets)) {
        throw new Error(`Invalid coding standard:\n"${configured}".`);
      }

      // If auto ruleset search is disabled, in single file mode, or standard is a simple name,
      // return the configured standard as-is.
      if (
        config.autoRulesetSearch === false ||
        isSingleFileMode() ||
        isStandardName(configured)
      ) {
        return configured;
      }

      let resolvedPath: string | null = null;
      const resource = document.uri;
      const folder = workspace.getWorkspaceFolder(resource);
      if (!folder) {
        return '';
      }

      let workspaceRoot = folder.uri.fsPath + pathSeparator;
      let localPath = resource.fsPath.replace(workspaceRoot, '');
      let paths = localPath
        .split(pathSeparator)
        .filter((path) => path.includes('.php') !== true);

      let searchPaths = [];

      // create search paths based on file location
      for (let i = 0, len = paths.length; i < len; i++) {
        searchPaths.push(
          workspaceRoot + paths.join(pathSeparator) + pathSeparator,
        );
        paths.pop();
      }
      searchPaths.push(workspaceRoot);

      // check each search path for an allowed ruleset
      let allowed = config.allowedAutoRulesets;

      let files: string[] = [];

      searchPaths.map((path) => {
        allowed.forEach((file) => {
          files.push(path + file);
        });
      });
      logger.debug('Standards Search paths: ', searchPaths);

      for (let i = 0, len = files.length; i < len; i++) {
        let c = files[i];
        try {
          await fs.access(c, fs.constants.R_OK | fs.constants.W_OK);
          return (resolvedPath = c);
        } catch (error) {
          continue;
        }
      }

      return resolvedPath ?? configured;
    },
  };
};

/**
 * Validates that a coding standard contains only safe characters and only legitimate formats.
 *
 * Supports any legitimate standard format while blocking injection attacks:
 * - Standard names (PSR1, PSR12, MyCustomStandard, etc.)
 * - XML ruleset files (./phpcs.xml, /path/to/ruleset.xml)
 * - Directory paths to standards (/path/to/MyStandard)
 * @see https://github.com/PHPCSStandards/PHP_CodeSniffer/wiki/Usage#specifying-a-coding-standard
 *
 * @param {string} standard The coding standard to validate
 * @param {string[]} allowedRulesets The allowed rulesets
 * @returns {boolean} True if standard contains only safe characters
 */
const isStandardValid = (
  standard: string,
  allowedRulesets: string[],
): boolean => {
  if (standard === '') return true; // Empty is allowed

  let standards: string[] = [standard];

  // Handle multiple standards separated by commas
  if (standard.includes(',')) {
    standards = standard.split(',');
  }

  for (const stnd of standards) {
    // Check if it's an allowed xml ruleset.
    // If standard is included in allowed rulesets array, AND it matches the xml ruleset pattern,
    // then it's valid.
    if (
      allowedRulesets.includes(stnd) &&
      /^[a-zA-Z0-9._/\\: -]+\.xml(\.dist)?$/i.test(stnd)
    ) {
      continue; // Valid - continue to next standard
    }

    // Check if it resembles a directory path to a standard
    // (doesn't actually check if it's a real path).
    if (/^[a-zA-Z0-9._/\\: -]+$/.test(stnd)) {
      continue; // Valid - continue to next standard
    }

    // If standard doesn't contain path separators, treat as standard name and
    // check if it's a safe standard name (only safe characters allowed
    // (alphanumeric, hyphens, underscores)).
    if (!stnd.includes(getPlatformPathSeparator())) {
      if (!isStandardName(stnd)) {
        return false;
      }

      continue; // Valid - continue to next standard
    }

    // If we reach here, the standard is invalid
    return false;
  }

  // All standards are valid
  return true;
};

/**
 * Determines if a standard string is a simple standard name
 * @param standard The coding standard string
 * @returns True if the standard is a simple name, false otherwise
 */
const isStandardName = (standard: string): boolean => {
  // Standard name can only contain alphanumeric characters, underscores, and hyphens.
  return /^[a-zA-Z0-9_-]+$/.test(standard);
};
