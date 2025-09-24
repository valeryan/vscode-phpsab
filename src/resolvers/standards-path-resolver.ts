import fs from 'node:fs/promises';
import { TextDocument, workspace } from 'vscode';
import { PathResolver } from '../interfaces/path-resolver';
import { ResourceSettings } from '../interfaces/resource-settings';
import { logger } from '../logger';
import { isSingleFileMode } from '../settings';
import {
  getPlatformExtension,
  getPlatformPathSeparator,
} from './path-resolver-utils';

export const createStandardsPathResolver = (
  document: TextDocument,
  config: ResourceSettings,
): PathResolver => {
  const extension = getPlatformExtension();
  const pathSeparator = getPlatformPathSeparator();
  return {
    extension,
    pathSeparator,
    resolve: async () => {
      let configured = config.standard ?? '';
      if (config.autoRulesetSearch === false || isSingleFileMode()) {
        return configured;
      }

      let resolvedPath: string | null = null;
      const resource = document.uri;
      const folder = workspace.getWorkspaceFolder(resource);
      if (!folder) {
        return '';
      }

      let workspaceRoot = folder.uri.fsPath + pathSeparator;
      let localPath = resource.fsPath.replace(workspaceRoot, '');
      let paths = localPath
        .split(pathSeparator)
        .filter((path) => path.includes('.php') !== true);

      let searchPaths = [];

      // create search paths based on file location
      for (let i = 0, len = paths.length; i < len; i++) {
        searchPaths.push(
          workspaceRoot + paths.join(pathSeparator) + pathSeparator,
        );
        paths.pop();
      }
      searchPaths.push(workspaceRoot);

      // check each search path for an allowed ruleset
      let allowed = config.allowedAutoRulesets;

      let files: string[] = [];

      searchPaths.map((path) => {
        allowed.forEach((file) => {
          files.push(path + file);
        });
      });
      logger.debug('Standards Search paths: ', searchPaths);

      for (let i = 0, len = files.length; i < len; i++) {
        let c = files[i];
        try {
          await fs.access(c, fs.constants.R_OK | fs.constants.W_OK);
          return (resolvedPath = c);
        } catch (error) {
          continue;
        }
      }

      return resolvedPath ?? configured;
    },
  };
};
