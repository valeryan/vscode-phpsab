import { PathResolver, PathResolverOptions } from '../interfaces/path-resolver';
import { createComposerPathResolver } from './composer-path-resolver';
import { createGlobalPathResolver } from './global-path-resolver';
import {
  getPlatformExtension,
  getPlatformPathSeparator,
} from './path-resolver-utils';

/**
 * Resolve the path to an executable using the provided resolvers.
 * @param {PathResolver[]} resolvers An array of PathResolver objects to attempt resolution with.
 * @returns {Promise<string>} A promise that resolves to the resolved path of the executable.
 */
const resolvePath = async (resolvers: PathResolver[]): Promise<string> => {
  let resolvedPath: string = '';
  for (const resolver of resolvers) {
    const resolverPath = await resolver.resolve();
    if (resolverPath) {
      resolvedPath = resolverPath;
      break;
    }
  }
  if (!resolvedPath) {
    throw new Error(`Unable to locate the executable.`);
  }
  return resolvedPath;
};

/**
 * Create a path resolver for the specified executable.
 * @param {PathResolverOptions} options The options for creating the path resolver.
 * @param {string} executable The name of the executable to resolve.
 * @returns {PathResolver} A PathResolver object for the specified executable.
 */
export const createPathResolver = (
  options: PathResolverOptions,
  executable: string,
): PathResolver => {
  const executableFile = executable + getPlatformExtension();
  const resolvers: PathResolver[] = [];

  // Add a composer path resolver if a workspace root is available, to prioritize
  // the workspace composer-installed executable over the global one.
  if (options.workspaceRoot) {
    resolvers.push(
      createComposerPathResolver(
        executableFile,
        options.workspaceRoot,
        options.composerJsonPath,
      ),
    );
  }
  resolvers.push(createGlobalPathResolver(executableFile));

  return {
    extension: getPlatformExtension(),
    pathSeparator: getPlatformPathSeparator(),
    resolve: async (): Promise<string> => {
      return resolvePath(resolvers);
    },
  };
};
