import { PathResolver } from '@phpsab/interfaces/path-resolver';
import { logger } from '@phpsab/services/logger';
import { access, constants, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';

/**
 * Create the path resolver for composer executable
 * @param workspaceRoot the path of the workspace
 * @param composerJsonPath The path to a composer.json file
 * @param executableFile name of executable to be search for
 * @returns callable function resolve
 */
export const createComposerExecutablePathResolver = (
  workspaceRoot: string,
  composerJsonPath: string,
  executableFile: string,
): PathResolver => {
  /**
   * Get the contents of the composer.json file
   * @param fullComposerJsonPath path to composer.json
   * @returns object
   */
  const getComposerConfig = async (fullComposerJsonPath: string) => {
    try {
      const composerFile = await readFile(fullComposerJsonPath, 'utf8');
      return JSON.parse(composerFile);
    } catch (error) {
      return {};
    }
  };

  /**
   * Search for the executable in the vendor folder
   * @param composerJsonPath path to composer.json
   * @returns string
   */
  const getVendorExecutablePath = async (
    fullComposerJsonPath: string,
  ): Promise<string> => {
    let basePath = dirname(fullComposerJsonPath);

    // Set the default path to the vendor bin executable
    let vendorPath = join(basePath, 'vendor', 'bin', executableFile);

    // Get the composer contents to check for custom paths
    let config = await getComposerConfig(fullComposerJsonPath);

    // Check if bin path has been customized
    if (config['config'] && config['config']['bin-dir']) {
      return join(basePath, config['config']['bin-dir'], executableFile);
    }

    // Check if vendor path has been customized
    if (config['config'] && config['config']['vendor-dir']) {
      return join(
        basePath,
        config['config']['vendor-dir'],
        'bin',
        executableFile,
      );
    }

    return vendorPath;
  };

  /**
   * Get the real path to the composer.json file
   * @returns string | undefined
   */
  const getComposerPath = async (): Promise<string | undefined> => {
    // Check if composerJsonPath is an absolute path
    if (isAbsolute(composerJsonPath)) {
      return composerJsonPath;
    }

    let fullComposerJsonPath = null;
    // check for and handle the default which is 'composer.json'
    if (composerJsonPath === 'composer.json') {
      try {
        fullComposerJsonPath = await realpath(
          join(workspaceRoot, composerJsonPath),
        );
      } catch (error) {
        return;
      }
      return fullComposerJsonPath;
    }

    // Try prepending the workspace root and checking if we can get a realpath
    try {
      fullComposerJsonPath = await realpath(
        join(workspaceRoot, composerJsonPath),
      );
    } catch (error) {
      return;
    }

    return fullComposerJsonPath;
  };

  const resolve = async () => {
    let resolvedPath: string = '';
    const fullComposerJsonPath = await getComposerPath();

    if (!fullComposerJsonPath) {
      logger.debug('Unable to locate the composer.json file.', {
        executableFile,
        workspaceRoot,
        composerJsonPath,
      });
      return '';
    }

    const executableFromVendor =
      await getVendorExecutablePath(fullComposerJsonPath);

    if (executableFromVendor) {
      try {
        access(executableFromVendor, constants.R_OK || constants.W_OK);
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
  };
  return {
    resolve,
  };
};
