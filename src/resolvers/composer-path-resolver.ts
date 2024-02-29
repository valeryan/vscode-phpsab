import fs from 'node:fs/promises';
import path from 'node:path';
import { PathResolver } from '../interfaces/path-resolver';
import {
  getPlatformExtension,
  getPlatformPathSeparator,
  joinPaths,
} from './path-resolver-utils';

const hasComposerDependency = async (
  composerLockPath: string,
): Promise<boolean> => {
  let dependencies = null;
  try {
    const lockFile = await fs.readFile(composerLockPath, 'utf8');
    dependencies = JSON.parse(lockFile);
  } catch (error) {
    dependencies = {};
  }

  let search = [];
  if (dependencies['packages-dev']) {
    search.push(dependencies['packages-dev']);
  }
  if (dependencies['packages']) {
    search.push(dependencies['packages']);
  }

  return search.some((pkgs) => {
    let match = pkgs.filter((pkg: any) => {
      return pkg.name === 'squizlabs/php_codesniffer';
    });
    return match.length !== 0;
  });
};

const getVendorPath = async (
  composerJsonPath: string,
  executableFile: string,
): Promise<string> => {
  let basePath = path.dirname(composerJsonPath);
  let vendorPath = joinPaths(basePath, 'vendor', 'bin', executableFile);

  let config = null;
  try {
    const composerFile = await fs.readFile(composerJsonPath, 'utf8');
    config = JSON.parse(composerFile);
  } catch (error) {
    config = {};
  }

  if (config['config'] && config['config']['vendor-dir']) {
    vendorPath = joinPaths(
      basePath,
      config['config']['vendor-dir'],
      'bin',
      executableFile,
    );
  }

  if (config['config'] && config['config']['bin-dir']) {
    vendorPath = joinPaths(
      basePath,
      config['config']['bin-dir'],
      executableFile,
    );
  }

  return vendorPath;
};

export const createComposerPathResolver = (
  executableFile: string,
  workspaceRoot: string,
  workingPath: string = '',
): PathResolver => {
  return {
    extension: getPlatformExtension(),
    pathSeparator: getPlatformPathSeparator(),
    resolve: async () => {
      let resolvedPath: string = '';
      const fullWorkingPath = path.isAbsolute(workingPath)
        ? workingPath
        : joinPaths(workspaceRoot, workingPath).replace(/composer.json$/, '');

      let composerJsonPath = '';
      let composerLockPath = '';
      try {
        composerJsonPath = await fs.realpath(
          joinPaths(fullWorkingPath, 'composer.json'),
        );

        composerLockPath = await fs.realpath(
          joinPaths(fullWorkingPath, 'composer.lock'),
        );
      } catch (error) {
        return '';
      }

      const vendorPath = await getVendorPath(composerJsonPath, executableFile);
      const hasPhpcs = await hasComposerDependency(composerLockPath);

      if (hasPhpcs && vendorPath) {
        try {
          fs.access(vendorPath, fs.constants.R_OK || fs.constants.W_OK);
          resolvedPath = vendorPath;
        } catch (error) {
          const relativeVendorPath = path.relative(workspaceRoot, vendorPath);
          throw new Error(
            `Composer phpcs dependency is configured but was not found under ${relativeVendorPath}. You may need to run "composer install" or set your executablePaths for phpcs & phpcbf manually.`,
          );
        }
      }

      return resolvedPath;
    },
  };
};
