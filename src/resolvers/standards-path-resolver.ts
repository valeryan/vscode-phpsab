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
  const pathSeparator = path.sep;
  const resource = document.uri;
  const folder = workspace.getWorkspaceFolder(resource);
  let workspaceRoot = folder ? folder.uri.fsPath : '';
  let localPath = resource.fsPath.replace(workspaceRoot, '');

  const createSearchPaths = () => {
    const paths = localPath
      .split(pathSeparator)
      .filter((p) => p && !p.includes('.php'));

    const searchPaths: string[] = [];

    for (let i = paths.length; i > 0; i--) {
      const subPath = paths.slice(0, i).join(pathSeparator);
      searchPaths.push(path.join(workspaceRoot, subPath));
    }
    searchPaths.push(workspaceRoot);

    return searchPaths;
  };

  const createFilesToCheck = (
    searchPaths: string[],
    allowedFiles: string[],
  ) => {
    const files: string[] = [];

    searchPaths.forEach((p) => {
      allowedFiles.forEach((f) => {
        files.push(p + pathSeparator + f);
      });
    });

    return files;
  };

  const resolve = async () => {
    let configured = config.standard ?? '';

    if (config.autoRulesetSearch === false) {
      return configured;
    }

    if (!folder) {
      return '';
    }

    const searchPaths = createSearchPaths();
    const filesToCheck = createFilesToCheck(
      searchPaths,
      config.allowedAutoRulesets,
    );

    logger.debug('Standards Search paths: ', searchPaths);

    for (let i = 0, len = filesToCheck.length; i < len; i++) {
      let c = filesToCheck[i];
      try {
        await fs.access(c, fs.constants.R_OK | fs.constants.W_OK);
        return c;
      } catch (error) {
        continue;
      }
    }

    return configured;
  };
  return {
    resolve,
  };
};
