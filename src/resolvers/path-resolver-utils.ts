import { logger } from '@phpsab/logger';
import path from 'node:path';

/**
 * Is the current platform Windows?
 * @returns boolean
 */
export const isWin = (): boolean => /^win/.test(process.platform);

export const getPlatformExtension = (): string => (isWin() ? '.bat' : '');

export const getPlatformPathSeparator = (): string => (isWin() ? '\\' : '/');

export const getEnvPathSeparator = (): string => (isWin() ? ';' : ':');

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
// Create passthrough methods for path, allows for easier replacement in test
export const joinPaths = (...args: string[]): string => path.join(...args);

/**
 * Normalize a path to the correct format for the current operating system.
 *
 * @param string The path to normalize.
 * @returns The normalized path.
 */
export const normalizePath = (string: string): string => {
  if (string === '') return '';
  return path.normalize(string);
};
