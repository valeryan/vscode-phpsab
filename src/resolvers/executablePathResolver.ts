import {
  PathResolver,
  PathResolverOptions,
} from '@phpsab/interfaces/pathResolver';
import { createComposerExecutablePathResolver } from '@phpsab/resolvers/executableComposerResolver';
import { createGlobalExecutablePathResolver } from '@phpsab/resolvers/executableGlobalResolver';

/**
 * Runs the given resolvers in order until a path is resolved.
 * @param resolvers - The resolvers to run.
 * @returns The resolved path, or an empty string if no path was resolved.
 */
const runResolvers = async (resolvers: PathResolver[]): Promise<string> => {
  let resolvedPath: string = '';
  for (const resolver of resolvers) {
    const resolverPath = await resolver.resolve();
    if (resolverPath) {
      resolvedPath = resolverPath;
      break;
    }
  }
  return resolvedPath;
};

/**
 * Creates a function to resolve an executable path.
 * This is a higher-order function that takes two functions to create resolvers,
 * and returns a function that uses these resolvers to resolve an executable path.
 * This is to make unit testing easier.
 * @param createComposerResolver - A function to create a composer resolver.
 * @param createGlobalResolver - A function to create a global resolver.
 * @returns A function resolves to the executable path.
 */
export const createResolveExecutablePath = (
  createComposerResolver: (
    workspaceRoot: string,
    composerJsonPath: string,
    executableFile: string,
  ) => PathResolver,
  createGlobalResolver: (executableFile: string) => PathResolver,
) => {
  return async (
    options: PathResolverOptions,
    executable: string,
  ): Promise<string> => {
    const executableFile = executable;
    const resolvers: PathResolver[] = [];
    if (options.workspaceRoot) {
      resolvers.push(
        createComposerResolver(
          options.workspaceRoot,
          options.composerJsonPath,
          executableFile,
        ),
      );
    }
    resolvers.push(createGlobalResolver(executableFile));
    return await runResolvers(resolvers);
  };
};

/**
 * Resolves an executable path using a composer resolver and a global resolver.
 * This is created by calling `createResolveExecutablePath` with `createComposerExecutablePathResolver`
 * and `createGlobalExecutablePathResolver`.
 * @param options - The resolver options.
 * @param executable - The executable to resolve.
 */
export const resolveExecutablePath: (
  options: PathResolverOptions,
  executable: string,
) => Promise<string> = createResolveExecutablePath(
  createComposerExecutablePathResolver,
  createGlobalExecutablePathResolver,
);
