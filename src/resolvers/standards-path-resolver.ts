import fs from 'node:fs/promises';
import { TextDocument, window, workspace } from 'vscode';
import { ConsoleError } from '../interfaces/console-error';
import { PathResolver } from '../interfaces/path-resolver';
import { ResourceSettings } from '../interfaces/settings';
import { logger } from '../logger';
import { isSingleFileMode } from '../settings';
import { getErrorCodeDescription } from '../utils/error-handling/error-helpers';
import {
  expandHomeDir,
  getPlatformExtension,
  getPlatformPathSeparator,
  isPathValid,
  normalizePath,
} from './path-resolver-utils';

/**
 * Create a path resolver for the coding standard ruleset
 * based on the provided document and configuration.
 * @param {TextDocument} document The text document for which to resolve the coding standard.
 * @param {ResourceSettings} config The resource settings containing the coding standard configuration.
 * @returns {PathResolver} A PathResolver object for the specified document and configuration, which resolves the path to the appropriate coding standard ruleset.
 */
export const createStandardsPathResolver = (
  document: TextDocument,
  config: ResourceSettings,
): PathResolver => {
  const extension = getPlatformExtension();
  const pathSeparator = getPlatformPathSeparator();
  return {
    extension,
    pathSeparator,
    resolve: async (): Promise<string> => {
      let errors: any = {};
      // `standard` may be a comma-separated list, so expand `~` in each entry individually.
      let configured = normalizePath(
        (config.standard ?? '').split(',').map(expandHomeDir).join(','),
      );

      if (!isStandardValid(configured)) {
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

      // Start auto-ruleset search...

      let resolvedPath: string | null = null;
      const resource = document.uri;
      const folder = workspace.getWorkspaceFolder(resource);

      // If no workspace folder found, set error and skip auto search
      if (!folder) {
        errors['NO_WORKSPACE'] = {
          errorCodeDescription: 'No workspace folder found for the document.',
          paths: [resource.fsPath],
        };
      }
      // Otherwise, perform auto ruleset search.
      else {
        let workspaceRoot = folder.uri.fsPath + pathSeparator;
        let localPath = resource.fsPath.replace(workspaceRoot, '');
        let paths = localPath
          .split(pathSeparator)
          .filter((path) => path.includes('.php') !== true);

        let searchPaths = [];

        // Create search paths based on file location
        for (let i = 0, len = paths.length; i < len; i++) {
          searchPaths.push(
            workspaceRoot + paths.join(pathSeparator) + pathSeparator,
          );
          paths.pop();
        }
        searchPaths.push(workspaceRoot);

        // Check each search path for an allowed ruleset
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

            logger.info(`Using the found coding standard ruleset: "${c}"`);

            return (resolvedPath = c);
          } catch (err) {
            const error: ConsoleError = err as ConsoleError;
            const errorCode = error.code ?? 'UNKNOWN';

            // If the error code key does not exist yet,
            // create it with an empty array as value.
            if (!errors[errorCode]) {
              errors[errorCode] = {
                errorCodeDescription: getErrorCodeDescription(errorCode),
                paths: [],
              };
            }
            // Store the path.
            errors[errorCode].paths.push(error.path);

            continue;
          }
        }
      }

      // If we reach here, no ruleset was found.

      // If no ruleset was found, show a warning message to the user and log it.
      if (!resolvedPath) {
        let warningTxt = 'Failed to automatically find a standard ruleset.\n';

        warningTxt += configured
          ? `Using the "phpsab.standard" setting instead: "${configured}"`
          : 'Using a ruleset that PHPCS itself found automatically or the default standard instead (the "phpsab.standard" setting is not set).';

        logger.warn(warningTxt);

        let errorMessage = 'Errors encountered while searching for rulesets:\n';
        for (const [errorCode, errorInfo] of Object.entries(errors)) {
          const info = errorInfo as {
            errorCodeDescription: string;
            paths: string[];
          };
          errorMessage += `${errorCode}: ${info.errorCodeDescription}\n`;
          info.paths.forEach((path: string) => {
            errorMessage += `  - "${path}"\n`;
          });
        }

        logger.debug(errorMessage);

        window.showWarningMessage(warningTxt);
      }

      // If no ruleset was found, return the configured standard.
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
 * @returns {boolean} True if standard contains only safe characters
 */
const isStandardValid = (standard: string): boolean => {
  if (standard === '') return true; // Empty is allowed

  let standards: string[] = [standard];

  // Handle multiple standards separated by commas
  if (standard.includes(',')) {
    standards = standard.split(',');
  }

  for (const stnd of standards) {
    // Standard is an XML ruleset path.

    // If standard is a valid XML ruleset path...
    if (isPathValid(stnd, 'xml|xml.dist')) {
      continue; // Valid - continue to next standard
    }

    // Directory path to a standard.

    // Check if it resembles a directory path to a standard
    // (doesn't actually check if it's a real path).
    if (isPathValid(stnd, '', true)) {
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
 * @param {string} standard The coding standard string
 * @returns {boolean} True if the standard is a simple name, false otherwise
 */
const isStandardName = (standard: string): boolean => {
  // Standard name can only contain alphanumeric characters, underscores, and hyphens.
  return /^[a-zA-Z0-9_-]+$/.test(standard);
};
