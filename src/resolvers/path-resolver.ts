import {
  PathResolver,
  PathResolverOptions,
} from '@phpsab/interfaces/path-resolver';
import { createComposerPathResolver } from '@phpsab/resolvers/composer-path-resolver';
import { createGlobalPathResolver } from '@phpsab/resolvers/global-path-resolver';
import {
  getPlatformExtension,
  getPlatformPathSeparator,
} from '@phpsab/resolvers/path-resolver-utils';

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

export const createPathResolver = (
  options: PathResolverOptions,
  executable: string,
): PathResolver => {
  const executableFile = executable + getPlatformExtension();
  const resolvers: PathResolver[] = [];
  // Add resolvers to find the executable using composer.
  if (options.workspaceRoot) {
    resolvers.push(
      createComposerPathResolver(
        executableFile,
        options.workspaceRoot,
        options.composerJsonPath,
      ),
    );
  }
  // Add a resolver to search through your systems env path
  resolvers.push(createGlobalPathResolver(executableFile));

  return {
    extension: getPlatformExtension(),
    pathSeparator: getPlatformPathSeparator(),
    resolve: async () => {
      return resolvePath(resolvers);
    },
  };
};
