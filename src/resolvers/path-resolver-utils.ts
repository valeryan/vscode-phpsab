import os from 'node:os';
import path from 'node:path';
import { logger } from '../logger';

/**
 * Is the current platform Windows?
 *
 * @returns boolean
 */
export const isWin = (): boolean => /^win/.test(process.platform);

/**
 * Get the executable script extension for the current platform.
 * Windows executable scripts typically have a '.bat' extension,
 * while POSIX systems have no extension.
 *
 * @returns The executable script extension for the current platform.
 */
export const getPlatformExtension = (): string => (isWin() ? '.bat' : '');

/**
 * Get the appropriate path separator for the current platform.
 * Windows uses '\' while POSIX systems use '/'.
 *
 * @returns The path separator for the current platform.
 */
export const getPlatformPathSeparator = (): string => (isWin() ? '\\' : '/');

/**
 * Get the appropriate PATH separator for the current platform to use when modifying
 * the PATH environment variable. Windows uses ';' while POSIX systems use ':'.
 *
 * @returns The PATH separator for the current platform.
 */
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

/**
 * Join multiple path segments into a single path string, normalizing separators for the current OS.
 *
 * @param args The path segments to join.
 * @returns The joined path string.
 */
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

/**
 * Expand a leading `~` in a path to the current user's home directory.
 * `path.isAbsolute()` treats `~/...` as a relative path, so this must run
 * before any absolute/relative branching on user-provided paths.
 *
 * @param inputPath The path to expand.
 * @returns The path with a leading `~` expanded to the home directory.
 */
export const expandHomeDir = (inputPath: string): string => {
  if (!inputPath) return inputPath;
  if (inputPath === '~') return os.homedir();
  if (inputPath.startsWith('~/') || (isWin() && inputPath.startsWith('~\\'))) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
};
