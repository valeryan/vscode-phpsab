import { PathResolver } from '../interfaces/path-resolver';
import {
  executableExists,
  getEnvPathSeparator,
  getPlatformExtension,
  getPlatformPathSeparator,
  joinPaths,
} from './path-resolver-utils';

/**
 * Create a global path resolver for the specified executable.
 * @param {string} executable The name of the executable to resolve globally.
 * @returns {PathResolver} A PathResolver object for the specified executable.
 */
export const createGlobalPathResolver = (executable: string): PathResolver => {
  const extension = getPlatformExtension();
  const pathSeparator = getPlatformPathSeparator();
  return {
    extension,
    pathSeparator,
    resolve: async () => {
      let envSeparator = getEnvPathSeparator();
      let resolvedPath: string = '';
      const envPath = process.env.PATH || '';
      let globalPaths: string[] = envPath.split(envSeparator);
      for (const globalPath of globalPaths) {
        let testPath = joinPaths(globalPath, executable);

        if (await executableExists(testPath)) {
          resolvedPath = testPath;
          break; // Stop loop if path is found
        }
      }
      return resolvedPath;
    },
  };
};
