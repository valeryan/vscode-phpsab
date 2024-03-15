import { PathResolver } from '@phpsab/interfaces/path-resolver';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { getEnvPathSeparator } from './path-resolver-utils';

export const createGlobalExecutablePathResolver = (
  executable: string,
): PathResolver => {
  return {
    resolve: async () => {
      let envSeparator = getEnvPathSeparator();
      let resolvedPath: string = '';
      const envPath = process.env.PATH || '';
      let globalPaths: string[] = envPath.split(envSeparator);
      for (const globalPath of globalPaths) {
        let testPath = join(globalPath, executable);
        try {
          await access(testPath, constants.X_OK);
          resolvedPath = testPath;
          break; // Stop loop if path is found
        } catch (error) {
          // Continue loop if path is not found
        }
      }
      return resolvedPath;
    },
  };
};
