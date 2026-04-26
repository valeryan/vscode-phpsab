import fs from 'node:fs/promises';
import path from 'node:path';
import { ResourceSettings } from '../interfaces/resource-settings';
import { toContainerPath } from '../resolvers/docker-path-resolver';

const hasPathSyntax = (standard: string): boolean => {
  return (
    standard.startsWith('/') ||
    standard.startsWith('\\') ||
    standard.startsWith('.') ||
    standard.includes('/') ||
    standard.includes('\\') ||
    /^[a-zA-Z]:[\\/]/.test(standard)
  );
};

const isReadableFile = async (filePath: string): Promise<boolean> => {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
};

const isBareRulesetFile = (
  standard: string,
  allowedRulesets: string[],
): boolean =>
  allowedRulesets.includes(standard) ||
  /^[a-zA-Z0-9._ -]+\.xml(\.dist)?$/i.test(standard);

const resolveHostStandardPath = async (
  standard: string,
  resourceConf: ResourceSettings,
): Promise<string | null> => {
  const workspaceRoot = resourceConf.workspaceRoot;
  if (!workspaceRoot) {
    return null;
  }

  if (path.isAbsolute(standard) || /^[a-zA-Z]:[\\/]/.test(standard)) {
    return standard;
  }

  if (hasPathSyntax(standard)) {
    return path.join(workspaceRoot, standard);
  }

  if (!isBareRulesetFile(standard, resourceConf.allowedAutoRulesets)) {
    return null;
  }

  const relativeRuleset = path.join(workspaceRoot, standard);
  return (await isReadableFile(relativeRuleset)) ? relativeRuleset : null;
};

/**
 * Convert a coding standard path to the equivalent container path.
 *
 * Simple standard names such as `PSR12` and `WordPress-Core` are left alone.
 * Path-like values are resolved against the workspace when needed. Bare values
 * such as `phpcs.xml` are mapped only when the file exists in the workspace.
 */
export const remapStandardForContainer = async (
  standard: string,
  resourceConf: ResourceSettings,
): Promise<string> => {
  if (!standard || !resourceConf.workspaceRoot) {
    return standard;
  }

  const hostStandardPath = await resolveHostStandardPath(
    standard,
    resourceConf,
  );

  if (!hostStandardPath) {
    return standard;
  }

  return toContainerPath(
    hostStandardPath,
    resourceConf.workspaceRoot,
    resourceConf.dockerWorkspaceRoot,
  );
};
