import * as fs from 'node:fs/promises';
import * as path from 'path';
import { PathResolver } from '../interfaces/path-resolver';
import {
  getPlatformExtension,
  getPlatformPathSeparator,
} from './path-resolver-utils';

export const createGlobalPathResolver = (executable: string): PathResolver => {
  const extension = getPlatformExtension();
  const pathSeparator = getPlatformPathSeparator();
  return {
    extension,
    pathSeparator,
    resolve: async () => {
      let envSeparator = /^win/.test(process.platform) ? ';' : ':';
      let resolvedPath: string | null = null;
      const envPath = process.env.PATH || '';
      let globalPaths: string[] = envPath.split(envSeparator);
      for (const globalPath of globalPaths) {
        let testPath = path.join(globalPath, executable);
        try {
          await fs.access(testPath, fs.constants.X_OK);
          resolvedPath = testPath;
          break; // Stop loop if path is found
        } catch (error) {
          // Continue loop if path is not found
        }
      }
      return resolvedPath ?? '';
    },
  };
};
