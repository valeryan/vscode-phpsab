import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { window } from 'vscode';
import { Settings } from './interfaces/settings';
import { logger } from './logger';

/**
 * Check PHPCS version compatibility and warn on 4.x versions.
 * @param {Settings} settings The extension settings
 * @return {Promise<void>}
 */
export const checkPhpcsVersionCompatibility = async (
  settings: Settings,
): Promise<void> => {
  // Check version compatibility for each workspace resource
  for (const resourceSettings of settings.resources) {
    let phpcsVersion: string | null = null;
    let phpcbfVersion: string | null = null;
    const resourceRoot = path.basename(resourceSettings.workspaceRoot || '');

    const phpcsExecutablePath = resourceSettings.executablePathCS;
    const phpcbfExecutablePath = resourceSettings.executablePathCBF;

    // If sniffer is enabled and PHPCS executable found, check it's version.
    if (resourceSettings.snifferEnable && phpcsExecutablePath) {
      phpcsVersion = await getPhpcsVersion(phpcsExecutablePath, 'PHPCS');
    }

    // If fixer is enabled and PHPCBF executable found, check it's version.
    if (resourceSettings.fixerEnable && phpcbfExecutablePath) {
      phpcbfVersion = await getPhpcsVersion(phpcbfExecutablePath, 'PHPCBF');
    }

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
    else if (phpcsVersion && phpcbfVersion && phpcsVersion !== phpcbfVersion) {
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
  }
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
    const result = spawnSync(`"${executablePath}" --version`, {
      encoding: 'utf8',
      shell: true,
      timeout: 5000,
    });

    // If the process failed, log the error and return null.
    if (result.status !== 0 || result.error) {
      logger.debug(
        `Failed to get ${executableName} version: ${result.error?.message || result.stderr}`,
      );
      return null;
    }

    // Get the output.
    const output = result.stdout.toString().trim();

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
