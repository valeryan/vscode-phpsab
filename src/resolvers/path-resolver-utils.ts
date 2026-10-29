import fs from 'node:fs/promises';
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
 * Windows uses '\\' while POSIX systems use '/'.
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

/**
 * Checks whether a given path is valid according to the constructed regex pattern.
 *
 * Validates both Windows and POSIX absolute paths, plus home directory
 * shortcut (`~/`) paths, and relative paths with CWD markers (`./`).
 * Supports files with specific extensions if provided, or directories
 * with optional trailing separators.
 *
 * @param {string} path The path to validate.
 * @param {string} [extension] The file extension that the final segment must match
 * (e.g. `"php"`, `"xml|xml.dist"`, etc.). Multiple extensions can be separated by `|`. Extension must not include the leading dot, but a dot in double extensions like `"xml.dist"` are allowed.
 * Omit or pass an empty string to allow a directories instead.
 * @param {boolean} [allowTrailingSeparator] Allow one trailing `/` or `\` after
 * the final segment. Should stay `false` when `extension` is given.
 * @returns {boolean} `true` if the path is valid according to the constructed pattern,
 * `false` otherwise.
 */
export const isPathValid = (
  path: string,
  extension?: string,
  allowTrailingSeparator?: boolean,
): boolean => {
  // Ensure the optional parameters have default values.
  allowTrailingSeparator = allowTrailingSeparator ?? false;
  extension = extension ?? '';

  // Reject any paths that contain UNC/device-path prefix (\\server\share, \\?\...) or
  // path traversal segments ("\..\..\"), either of which could potentially allow a
  // path to escape its intended scope.
  if (/^[\\/]{2}/.test(path) || path.split(/[\\/]+/).includes('..')) {
    return false;
  }

  // [Optional] Windows absolute path drive letter ("C:\" or "C:/"), OR
  // POSIX absolute path with a single leading slash ("/" or "\"), OR
  // relative CWD path marker ("./" or ".\"), OR
  // home dir shortcut ("~/" or "~\").
  const driveOrRootPrefix = /(?:[a-zA-Z]:[\\/]|[\\/]|[.~][\\/])?/;

  // One path segment (name + separator), e.g. "foo/" or "foo\". Names may
  // start with "." since dotfiles/folders are valid (e.g. ".config/").
  const pathSegment = /[a-zA-Z0-9._ ()-]+[\\/]/;

  // Allowed characters for the final segment's name, before its extension (if any).
  const nameChars = /[a-zA-Z0-9._ ()-]+/;

  // An optional single trailing separator, e.g. the ending "/" in "foo/bar/".
  const trailingSeparator = allowTrailingSeparator ? /[\\/]?/.source : '';

  // Prepare the extension pattern by splitting multiple extensions by "|",
  // removing any leading dot from each extension, then splitting each
  // extension by the middle dot (for the case of multi-part extensions)
  // and joining them back with an escaped dot, so they are treated as
  // literal dots in the regex. It adds a leading escaped dot for each
  // extension, and joins them back with "|".
  const prepareExtension = extension
    .split('|')
    .map((ext) => `\\.${ext.replace(/^\./, '').split('.').join('\\.')}`)
    .join('|');

  // Create the final extension pattern as a non-capturing group if extensions
  // are provided, otherwise an empty string.
  const extPattern = extension ? `(?:${prepareExtension})` : '';

  // Construct the path pattern, with the case-insensitive flag.
  const regex = new RegExp(
    `^${driveOrRootPrefix.source}(?:${pathSegment.source})*${nameChars.source}${extPattern}${trailingSeparator}$`,
    'i',
  );

  // Test the constructed regex to ensure it's a valid path and return the result.
  return regex.test(path);
};

/**
 * Check if the given executable path exists and is accessible.
 * @param {string} path The path to the executable file.
 * @returns {Promise<boolean>} A promise that resolves to true if the executable exists and is accessible, false otherwise.
 */
export const executableExists = async (path: string): Promise<boolean> => {
  try {
    // Check if the path is provided. If not, return false.
    if (!path) {
      return false;
    }

    // Check if the path is a file, if it's not return false.
    const stat = await fs.stat(path);
    if (!stat.isFile()) {
      return false;
    }

    // Check if the file is executable by testing the execute permission on POSIX systems.
    // On Windows, this will only check if the file exists.
    await fs.access(path, fs.constants.X_OK);
    return true;
  } catch (error) {
    return false;
  }
};
