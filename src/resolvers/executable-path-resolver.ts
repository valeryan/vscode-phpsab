import {
  PathResolver,
  PathResolverOptions,
} from '@phpsab/interfaces/path-resolver';
import { logger } from '@phpsab/services/logger';
import fs from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { getEnvPathSeparator } from './path-resolver-utils';

/**
 * Search for the executable in the vendor folder
 * @param composerJsonPath path to composer.json
 * @param executableFile name of the executable to resolve from vendor
 * @returns string
 */
const getVendorExecutablePath = async (
  composerJsonPath: string,
  executableFile: string,
): Promise<string> => {
  let basePath = dirname(composerJsonPath);
  let vendorPath = join(basePath, 'vendor', 'bin', executableFile);

  let config = null;
  try {
    const composerFile = await fs.readFile(composerJsonPath, 'utf8');
    config = JSON.parse(composerFile);
  } catch (error) {
    config = {};
  }

  if (config['config'] && config['config']['vendor-dir']) {
    vendorPath = join(
      basePath,
      config['config']['vendor-dir'],
      'bin',
      executableFile,
    );
  }

  if (config['config'] && config['config']['bin-dir']) {
    vendorPath = join(basePath, config['config']['bin-dir'], executableFile);
  }

  return vendorPath;
};

/**
 * Create the path resolver for composer executable
 * @param executableFile name of executable to be search for
 * @param workspaceRoot the path of the workspace
 * @param composerJsonPath The path to a composer.json file
 * @returns callable function resolve
 */
export const createComposerPathResolver = (
  executableFile: string,
  workspaceRoot: string,
  composerJsonPath: string = '',
): PathResolver => {
  return {
    resolve: async () => {
      let resolvedPath: string = '';
      const fullWorkingPath = isAbsolute(composerJsonPath)
        ? composerJsonPath
        : join(workspaceRoot, composerJsonPath).replace(/composer.json$/, '');

      let fullComposerJsonPath = '';
      try {
        fullComposerJsonPath = await fs.realpath(
          join(fullWorkingPath, 'composer.json'),
        );
      } catch (error) {
        logger.debug('Unable to locate the composer.json file.', {
          workspaceRoot,
          composerJsonPath,
          executableFile,
        });
        return '';
      }

      const executableFromVendor = await getVendorExecutablePath(
        fullComposerJsonPath,
        executableFile,
      );

      if (executableFromVendor) {
        try {
          fs.access(
            executableFromVendor,
            fs.constants.R_OK || fs.constants.W_OK,
          );
          resolvedPath = executableFromVendor;
        } catch (error) {
          const relativeVendorPath = relative(
            workspaceRoot,
            executableFromVendor,
          );
          logger.debug(
            `${executableFile} was not found in ${relativeVendorPath}. You may need to run "composer install".`,
            error,
          );
          return '';
        }
      }

      return resolvedPath;
    },
  };
};

export const createGlobalPathResolver = (executable: string): PathResolver => {
  return {
    resolve: async () => {
      let envSeparator = getEnvPathSeparator();
      let resolvedPath: string = '';
      const envPath = process.env.PATH || '';
      let globalPaths: string[] = envPath.split(envSeparator);
      for (const globalPath of globalPaths) {
        let testPath = join(globalPath, executable);
        try {
          await fs.access(testPath, fs.constants.X_OK);
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

export const resolveExecutablePath = async (
  options: PathResolverOptions,
  executable: string,
): Promise<string> => {
  const executableFile = executable;
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
  return await runResolvers(resolvers);
};
