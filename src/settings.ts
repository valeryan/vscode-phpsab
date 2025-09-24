import fs from 'node:fs/promises';
import path from 'node:path';
import { Uri, WorkspaceConfiguration, window, workspace } from 'vscode';
import { ResourceSettings } from './interfaces/resource-settings';
import { Settings } from './interfaces/settings';
import { logger } from './logger';
import { createPathResolver } from './resolvers/path-resolver';

/**
 * Check if the editor is in single file mode.
 * @returns {boolean} `true` if no workspace folders are open
 */
export const isSingleFileMode = (): boolean => {
  return !workspace.workspaceFolders;
};

/**
 * Attempt to find the root path for a workspace or resource
 * @param resource
 */
const resolveRootPath = (resource: Uri) => {
  // try to get a valid folder from resource
  let folder = workspace.getWorkspaceFolder(resource);

  // one last safety check
  return folder ? folder.uri.fsPath : '';
};

/**
 * Get correct executable path from resolver
 * @param settings
 */
const resolveCBFExecutablePath = async (
  settings: ResourceSettings,
): Promise<ResourceSettings> => {
  if (!settings.executablePathCBF) {
    let executablePathResolver = createPathResolver(settings, 'phpcbf');
    settings.executablePathCBF = await executablePathResolver.resolve();
  } else if (
    !path.isAbsolute(settings.executablePathCBF) &&
    settings.workspaceRoot !== null
  ) {
    settings.executablePathCBF = path.join(
      settings.workspaceRoot,
      settings.executablePathCBF,
    );
  }
  return settings;
};

/**
 * Get correct executable path from resolver
 * @param settings
 */
const resolveCSExecutablePath = async (
  settings: ResourceSettings,
): Promise<ResourceSettings> => {
  if (!settings.executablePathCS) {
    let executablePathResolver = createPathResolver(settings, 'phpcs');
    settings.executablePathCS = await executablePathResolver.resolve();
  } else if (
    !path.isAbsolute(settings.executablePathCS) &&
    settings.workspaceRoot !== null
  ) {
    settings.executablePathCS = path.join(
      settings.workspaceRoot,
      settings.executablePathCS,
    );
  }
  return settings;
};

const executableExist = async (path: string) => {
  try {
    if (!path) {
      return false;
    }
    await fs.access(path, fs.constants.X_OK);
    return true;
  } catch (error) {
    return false;
  }
};

const validate = async (
  settings: ResourceSettings,
  resource: string,
): Promise<ResourceSettings> => {
  if (
    settings.snifferEnable &&
    !(await executableExist(settings.executablePathCS))
  ) {
    logger.log(`The phpcs executable was not found for ${resource}`);
    settings.snifferEnable = false;
  }
  if (
    settings.fixerEnable &&
    !(await executableExist(settings.executablePathCBF))
  ) {
    logger.log(`The phpcbf executable was not found for ${resource}`);
    settings.fixerEnable = false;
  }
  return settings;
};

export const loadSettings = async () => {
  const resourcesSettings: Array<ResourceSettings> = [];

  const globalConfig = workspace.getConfiguration('phpsab', null);

  // Handle case where no workspace folders exist (single file mode).
  if (isSingleFileMode()) {
    const warningMsg =
      'No workspace folder open. PHP Sniffer & Beautifier requires a workspace to function properly. Activating single file mode.';

    logger.warn(warningMsg);
    window.showWarningMessage(warningMsg);

    let settings = await getSettings(globalConfig);
    settings = await validate(settings, 'Single File Mode');

    resourcesSettings.splice(0, 0, settings);
  } else {
    // Handle per Workspace settings

    // We know workspaceFolders is not null from the isSingleFileMode check above,
    // so we can assert it with the non-null assertion operator `!`.
    // https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#non-null-assertion-operator-postfix-
    const workspaceFolders = workspace.workspaceFolders!;

    for (let index = 0; index < workspaceFolders.length; index++) {
      const resource = workspaceFolders[index].uri;
      const config = workspace.getConfiguration('phpsab', resource);
      const rootPath = resolveRootPath(resource);

      let settings = await getSettings(config, rootPath);

      settings = await validate(settings, workspaceFolders[index].name);

      resourcesSettings.splice(index, 0, settings);
    }
  }

  // update settings from config
  let settings: Settings = {
    resources: resourcesSettings,
    snifferMode: globalConfig.get('snifferMode', 'onSave'),
    snifferShowSources: globalConfig.get('snifferShowSources', false),
    snifferTypeDelay: globalConfig.get('snifferTypeDelay', 250),
    debug: globalConfig.get('debug', false),
  };

  logger.setDebugMode(settings.debug);
  logger.debug('CONFIGURATION', settings);

  return settings;
};

/**
 * Get settings from the workspace configuration.
 * @param {WorkspaceConfiguration} config The workspace configuration to retrieve settings from.
 * @param {string | null} rootPath The root path of the workspace or `null` if in single file mode.
 * @returns {Promise<ResourceSettings>} The resource settings for the workspace.
 */
const getSettings = async (
  config: WorkspaceConfiguration,
  rootPath: string | null = null,
) => {
  let settings: ResourceSettings = {
    fixerEnable: config.get('fixerEnable', true),
    fixerArguments: config.get('fixerArguments', []),
    workspaceRoot: rootPath,
    executablePathCBF: config.get('executablePathCBF', ''),
    executablePathCS: config.get('executablePathCS', ''),
    composerJsonPath: config.get('composerJsonPath', 'composer.json'),
    standard: config.get('standard', ''),
    autoRulesetSearch: config.get('autoRulesetSearch', true),
    allowedAutoRulesets: config.get('allowedAutoRulesets', [
      '.phpcs.xml',
      'phpcs.xml',
      'phpcs.dist.xml',
      'ruleset.xml',
    ]),
    snifferEnable: config.get('snifferEnable', true),
    snifferArguments: config.get('snifferArguments', []),
  };

  settings = await resolveCBFExecutablePath(settings);
  settings = await resolveCSExecutablePath(settings);

  return settings;
};
