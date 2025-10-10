import path from 'node:path';

/**
 * Is the current platform Windows?
 * @returns boolean
 */
export const isWin = (): boolean => /^win/.test(process.platform);

export const getPlatformExtension = (): string => (isWin() ? '.bat' : '');

export const getPlatformPathSeparator = (): string => (isWin() ? '\\' : '/');

export const getEnvPathSeparator = (): string => (isWin() ? ';' : ':');

// Create passthrough methods for path, allows for easier replacement in test
export const joinPaths = (...args: string[]): string => path.join(...args);
