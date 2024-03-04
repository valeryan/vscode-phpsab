import fs from 'node:fs/promises';
import path from 'node:path';

export const getPlatformExtension = (): string =>
  /^win/.test(process.platform) ? '.bat' : '';

export const getPlatformPathSeparator = (): string =>
  /^win/.test(process.platform) ? '\\' : '/';

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

export const crossPath = (inputPath: string): string => {
  if (/^win/.test(process.platform)) {
    // Convert Unix-style paths with drive specified to Windows paths
    const driveLetterMatch = inputPath.match(/^\/([a-zA-Z])\//);
    if (driveLetterMatch) {
      const driveLetter = driveLetterMatch[1].toUpperCase();
      inputPath = inputPath.replace(`/${driveLetter}/`, `${driveLetter}:\\`);
    }

    // Convert Unix-style paths to Windows paths
    inputPath = inputPath.replace(/\//g, '\\');
    inputPath = inputPath + getPlatformExtension();
  } else {
    // Remove drive letters from the front of the path on non-Windows systems
    inputPath = inputPath.replace(/^\/[a-zA-Z]\//, '/');
  }

  return path.resolve(inputPath);
};
