import fs from 'node:fs/promises';
import { logger } from '../services/logger';

export const getPlatformExtension = (): string =>
  /^win/.test(process.platform) ? '.bat' : '';

export const getEnvPathSeparator = (): string =>
  /^win/.test(process.platform) ? ';' : ':';

export const executableExist = async (path: string) => {
  try {
    if (!path) {
      return false;
    }
    await fs.access(path, fs.constants.X_OK);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Takes a unix style path and transforms it to windows if needed
 * @param inputPath string the unix style path
 * @returns string platform correct path
 */
export const crossPath = (inputPath: string): string => {
  if (/^win/.test(process.platform)) {
    // Convert Unix-style paths with drive specified to Windows paths
    const driveLetterMatch = inputPath.match(/^\/([a-zA-Z])\//);
    if (driveLetterMatch) {
      const driveLetter = driveLetterMatch[1].toLowerCase();
      inputPath = inputPath.replace(`/${driveLetter}/`, `${driveLetter}:\\`);
    }

    // Convert Unix-style paths to Windows paths
    inputPath = inputPath.replace(/\//g, '\\');
  } else {
    // Remove drive letters from the front of the path on non-Windows systems
    inputPath = inputPath.replace(/^\/[a-zA-Z]\//, '/');
  }

  return inputPath;
};

/**
 * Adds the PHP executable path to the Node process's environment path.
 *
 * @param phpExecutablePath The PHP executable path from extension settings.
 */
export const addPhpToEnvPath = (phpExecutablePath: string) => {
  // If the path ends with php.exe, remove it because we only need the directory path.
  if (phpExecutablePath.endsWith('php.exe')) {
    phpExecutablePath = phpExecutablePath.replace('php.exe', '');
  }

  if (!process.env?.PATH?.includes(phpExecutablePath)) {
    process.env.PATH =
      process.env.PATH + getEnvPathSeparator() + phpExecutablePath;
    logger.debug(
      `Added PHP executable path (${phpExecutablePath}) to extension environment.`,
    );
  }
};

/**
 * Is the current platform Windows?
 * @returns boolean
 */
export const isWin = (): boolean => /^win/.test(process.platform);
