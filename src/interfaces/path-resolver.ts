/**
 * A path resolver.
 */
export interface PathResolver {
  /**
   * Resolves the path.
   * @returns {Promise<string>} A promise that resolves to the absolute path.
   */
  resolve: () => Promise<string>;
  /**
   * The file extension used by the executable (e.g., '.exe' on Windows).
   */
  extension: string;

  /**
   * The path separator used by the operating system (e.g., '/' on Unix, '\\' on Windows).
   */
  pathSeparator: string;
}

/**
 * Path resolver options.
 */
export interface PathResolverOptions {
  /**
   * The root directory of the workspace. Can be null if not applicable.
   */
  workspaceRoot: string | null;

  /**
   * The path to the composer.json file.
   */
  composerJsonPath: string;
}
