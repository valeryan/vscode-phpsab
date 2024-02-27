import path from 'node:path';

export const getPlatformExtension = (): string =>
  /^win/.test(process.platform) ? '.bat' : '';

export const getPlatformPathSeparator = (): string =>
  /^win/.test(process.platform) ? '\\' : '/';

export const getEnvPathSeparator = (): string =>
  /^win/.test(process.platform) ? ';' : ':';

// Create passthrough methods for path, allows for easier replacement in test
export const joinPaths = (...args: string[]): string => path.join(...args);
