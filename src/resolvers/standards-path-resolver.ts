import { PathResolver } from '@phpsab/interfaces/path-resolver';
import { ResourceSettings } from '@phpsab/interfaces/settings';
import { logger } from '@phpsab/services/logger';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TextDocument, workspace } from 'vscode';

export const createStandardsPathResolver = (
  document: TextDocument,
  config: ResourceSettings,
): PathResolver => {
  return {
    resolve: async () => {
      let configured = config.standard ?? '';
      const pathSeparator = path.sep;

      // Auto search is disable job done.
      if (config.autoRulesetSearch === false) {
        return configured;
      }

      let resolvedPath: string | null = null;
      const resource = document.uri;
      const folder = workspace.getWorkspaceFolder(resource);
      if (!folder) {
        return '';
      }

      let workspaceRoot = folder.uri.fsPath;
      let localPath = resource.fsPath.replace(workspaceRoot, '');

      // Split up the path of the PHP file for tree traversal
      const paths = localPath
        .split(pathSeparator)
        .filter((path) => path && !path.includes('.php'));

      const searchPaths: string[] = [];

      // Create search paths based on file location
      for (let i = paths.length; i > 0; i--) {
        const subPath = paths.slice(0, i).join(pathSeparator);
        searchPaths.push(path.join(workspaceRoot, subPath));
      }
      searchPaths.push(workspaceRoot);

      // Check each search path for an allowed ruleset
      const allowed = config.allowedAutoRulesets;
      const files: string[] = [];

      searchPaths.forEach((path) => {
        allowed.forEach((file) => {
          files.push(path + pathSeparator + file);
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
