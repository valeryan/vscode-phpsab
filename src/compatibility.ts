import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { window } from 'vscode';
import { Settings } from './interfaces/settings';
import { logger } from './logger';

const execAsync = promisify(exec);

/**
 * Check the compatibility of the PHP environment and PHPCS/PHPCBF versions.
 * @param {Settings} settings The extension settings.
 */
export const checkCompatibility = async (settings: Settings): Promise<void> => {
  await checkPhpVersion();

  await checkPhpcsVersionCompatibility(settings);
};

/**
 * Check PHPCS version compatibility and warn on 4.x versions.
 * @param {Settings} settings The extension settings
 * @return {Promise<void>}
 */
const checkPhpcsVersionCompatibility = async (
  settings: Settings,
): Promise<void> => {
  // Check version compatibility for each workspace resource in parallel.
  await Promise.all(
    settings.resources.map(async (resourceSettings) => {
      const resourceRoot = path.basename(resourceSettings.workspaceRoot || '');

      const phpcsExecutablePath = resourceSettings.executablePathCS;
      const phpcbfExecutablePath = resourceSettings.executablePathCBF;

      // If sniffer/fixer is enabled and its executable found, check its version.
      const [phpcsVersion, phpcbfVersion] = await Promise.all([
        resourceSettings.snifferEnable && phpcsExecutablePath
          ? getPhpcsVersion(phpcsExecutablePath, 'PHPCS')
          : null,
        resourceSettings.fixerEnable && phpcbfExecutablePath
          ? getPhpcsVersion(phpcbfExecutablePath, 'PHPCBF')
          : null,
      ]);

      let warningMsg = '';

      // Check for version detection issues

      // If neither version could be determined AND sniffer or fixer is enabled, warn the user.
      if (
        !phpcsVersion &&
        !phpcbfVersion &&
        resourceSettings.snifferEnable &&
        resourceSettings.fixerEnable
      ) {
        warningMsg = `Could not determine version of PHPCS/PHPCBF from "${resourceRoot}". Please ensure the executables are working correctly.`;
      }
      // If PHPCS version could not be determined AND sniffer is enabled, warn the user.
      else if (!phpcsVersion && resourceSettings.snifferEnable) {
        warningMsg = `Could not determine version of PHPCS from "${resourceRoot}". Please ensure the executable is working correctly.`;
      }
      // If PHPCBF version could not be determined AND fixer is enabled, warn the user.
      else if (!phpcbfVersion && resourceSettings.fixerEnable) {
        warningMsg = `Could not determine version of PHPCBF from "${resourceRoot}". Please ensure the executable is working correctly.`;
      }
      // Check for version mismatches when both versions are available
      else if (
        phpcsVersion &&
        phpcbfVersion &&
        phpcsVersion !== phpcbfVersion
      ) {
        warningMsg = `Version mismatch detected: PHPCS version ${phpcsVersion} and PHPCBF version ${phpcbfVersion} from "${resourceRoot}". This may lead to unexpected behavior. Please ensure both are from the same installation directory.`;
      }
      // Check for unsupported versions
      else if (checkUnsupportedVersion(phpcsVersion, phpcbfVersion)) {
        const version = phpcsVersion || phpcbfVersion;
        warningMsg = `Version ${version} detected in "${resourceRoot}". Version 4.x is not supported yet. Some features may not work as expected. Please consider downgrading to the latest 3.x version.`;
      }

      // Only show warning if there's a message to display.
      if (warningMsg) {
        logger.warn(warningMsg);
        window.showWarningMessage(warningMsg, 'OK');
      }
    }),
  );
};

/**
 * Get the version of PHPCS or PHPCBF
 * @param {string} executablePath The path to the PHPCS or PHPCBF executable
 * @param {string} executableName The name of the executable (phpcs or phpcbf) for logging
 * @returns {Promise<string | null>} The version string or null if it couldn't be determined
 */
const getPhpcsVersion = async (
  executablePath: string,
  executableName: string,
): Promise<string | null> => {
  // If no executable path is provided, return null.
  if (!executablePath) {
    return null;
  }

  try {
    // Run the executable with --version
    let stdout: string;
    try {
      ({ stdout } = await execAsync(`"${executablePath}" --version`, {
        encoding: 'utf8',
        timeout: 5000,
      }));
    } catch (err) {
      // If the process failed, log the error and return null.
      const failure = err as Error & { stderr?: string };
      logger.debug(
        `Failed to get ${executableName} version: ${failure.message || failure.stderr}`,
      );
      return null;
    }

    // Get the output.
    const output = stdout.toString().trim();

    // Verify that the matched string contains "PHP_CodeSniffer".
    // This ensures it's the correct executable.
    if (!output.includes('PHP_CodeSniffer')) {
      const errorMsg = `Invalid output string for ${executableName}: ${output}`;
      logger.debug(errorMsg);

      throw new Error(errorMsg);
    }

    // Match version patterns like "PHP_CodeSniffer version 3.7.2".
    const versionMatch = output.match(/(\d+)\.(\d+)\.(\d+)/);

    // If no version match is found, log and return null.
    if (!versionMatch) {
      logger.debug(
        `Could not obtain ${executableName} version from output:`,
        output,
      );
      return null;
    }

    // Get the full version string from the match array.
    const version = versionMatch[0];

    logger.info(`${executableName} version: ${version}`);

    return version;
  } catch (error) {
    // Log any exceptions and return null.
    const errorMsg = `Exception while getting the ${executableName} version: ${error}`;
    logger.debug(errorMsg);
    window.showErrorMessage(errorMsg, 'OK');
    return null;
  }
};

/**
 * Check if the given version is unsupported.
 * @param {string | null} phpcsVersion The PHPCS version string to check.
 * @param {string | null} phpcbfVersion The PHPCBF version string to check.
 * @returns {boolean} `true` if the version is unsupported, `false` otherwise.
 */
const checkUnsupportedVersion = (
  phpcsVersion: string | null,
  phpcbfVersion: string | null,
): boolean => {
  const unsupportedVersion = '4.';

  return (
    (phpcsVersion != null && phpcsVersion.startsWith(unsupportedVersion)) ||
    (phpcbfVersion != null && phpcbfVersion.startsWith(unsupportedVersion))
  );
};

/**
 * Check the PHP version by running `php --version` and parsing the output.
 * This helps to determine whether the correct PHP executable is being
 * used and retrieves its version.
 * @returns {Promise<string | null>} The PHP version string if available, otherwise null.
 */
const checkPhpVersion = async (): Promise<string | null> => {
  try {
    let stdout: string;
    try {
      ({ stdout } = await execAsync(`php --version`, {
        encoding: 'utf8',
        timeout: 5000,
        env: process.env,
      }));
    } catch (err) {
      // If the process failed, log the error and return null.
      const failure = err as Error & { stderr?: string };
      logger.debug(
        `Failed to get PHP version: ${failure.message || failure.stderr}`,
      );
      return null;
    }

    // Get the output.
    const output = stdout.toString().trim();

    // Verify that the matched string contains "PHP".
    // This ensures it's the correct executable.
    if (!output.includes('PHP')) {
      const errorMsg = `Invalid output string for PHP: ${output}`;
      logger.debug(errorMsg);

      throw new Error(errorMsg);
    }

    // Match version patterns like "PHP 8.2.35".
    const versionMatch = output.match(/(\d+)\.(\d+)\.(\d+)/);

    // If no version match is found, log and return null.
    if (!versionMatch) {
      logger.debug(`Could not obtain PHP version from output:`, output);
      return null;
    }

    // Get the full version string from the match array.
    const version = versionMatch[0];

    logger.info(`PHP version: ${version}`);

    return version;
  } catch (error) {
    // Log any exceptions and return null.
    const errorMsg = `Exception while getting the php version: ${error}`;
    logger.debug(errorMsg);
    window.showErrorMessage(errorMsg, 'OK');
    return null;
  }
};
