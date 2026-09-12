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
