import { PathResolver } from '../interfaces/path-resolver';
import { createComposerPathResolver } from './composer-path-resolver';
import { createGlobalPathResolver } from './global-path-resolver';
import {
  getPlatformExtension,
  getPlatformPathSeparator,
} from './path-resolver-utils';

interface PathResolverOptions {
  workspaceRoot: string | null;
  composerJsonPath: string;
}

const resolvePath = async (resolvers: PathResolver[]): Promise<string> => {
  let resolvedPath: string | null = null;
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
  if (options.workspaceRoot !== null) {
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
    resolve: async () => {
      return resolvePath(resolvers);
    },
  };
};
