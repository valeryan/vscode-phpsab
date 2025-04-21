import path from 'node:path';

export const getPlatformExtension = (): string =>
  /^win/.test(process.platform) ? '.bat' : '';

export const getPlatformPathSeparator = (): string =>
  /^win/.test(process.platform) ? '\\' : '/';

export const getEnvPathSeparator = (): string =>
  /^win/.test(process.platform) ? ';' : ':';

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

  if (!process.env.PATH.includes(phpExecutablePath)) {
    process.env.PATH =
      process.env.PATH + getEnvPathSeparator() + phpExecutablePath;
  }
};
// Create passthrough methods for path, allows for easier replacement in test
export const joinPaths = (...args: string[]): string => path.join(...args);
