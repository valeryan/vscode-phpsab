import fs from 'node:fs/promises';
import path from 'node:path';
import { Uri, WorkspaceConfiguration, window, workspace } from 'vscode';
import { ResourceSettings } from './interfaces/resource-settings';
import { Settings } from './interfaces/settings';
import { logger } from './logger';
import { createPathResolver } from './resolvers/path-resolver';
import { joinPaths, normalizePath } from './resolvers/path-resolver-utils';
import { getExtensionInfo } from './utils/helpers';

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
  // If no path is set, try and find it via the path resolver.
  if (!settings.executablePathCBF) {
    let executablePathResolver = createPathResolver(settings, 'phpcbf');
    settings.executablePathCBF = await executablePathResolver.resolve();
  }
  // If a relative path is set, resolve it against the workspace root.
  else if (
    !path.isAbsolute(settings.executablePathCBF) &&
    settings.workspaceRoot !== null
  ) {
    settings.executablePathCBF = joinPaths(
      settings.workspaceRoot,
      settings.executablePathCBF,
    );
  }
  // Otherwise normalize the absolute path.
  else {
    settings.executablePathCBF = normalizePath(settings.executablePathCBF);
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
  // If no path is set, try and find it via the path resolver.
  if (!settings.executablePathCS) {
    let executablePathResolver = createPathResolver(settings, 'phpcs');
    settings.executablePathCS = await executablePathResolver.resolve();
  }
  // If a relative path is set, resolve it against the workspace root.
  else if (
    !path.isAbsolute(settings.executablePathCS) &&
    settings.workspaceRoot !== null
  ) {
    settings.executablePathCS = joinPaths(
      settings.workspaceRoot,
      settings.executablePathCS,
    );
  }
  // Otherwise normalize the absolute path.
  else {
    settings.executablePathCS = normalizePath(settings.executablePathCS);
  }

  return settings;
};

/**
 * Resolve PHP executable path with proper precedence handling
 * @param {WorkspaceConfiguration} config phpsab configuration
 * @param {WorkspaceConfiguration} phpConfig php configuration
 * @returns {string} The resolved PHP executable path
 */
const resolvePhpExecutablePath = async (
  config: WorkspaceConfiguration,
  phpConfig: WorkspaceConfiguration,
): Promise<string> => {
  const phpExecutableSources = [
    {
      name: 'VSCode PHP Language Features Built-in Extension',
      path: phpConfig.get<string>('validate.executablePath', ''),
    },
    {
      name: 'Devsense PHP Tools Extension',
      path: phpConfig.get<string>('executablePath', ''),
    },
    {
      name: 'PHPSAB Extension',
      path: config.get<string>('phpExecutablePath', ''),
    },
  ];

  for (const source of phpExecutableSources) {
    // Return the first valid (non-empty) existing executable path found
    if (source.path && (await executableExist(source.path))) {
      logger.debug(`Using PHP executable from ${source.name}: ${source.path}`);
      return source.path;
    }
  }

  // If no executable path is found, return an empty string
  return '';
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
  let msg = '';
  if (
    settings.snifferEnable &&
    !(await executableExist(settings.executablePathCS))
  ) {
    msg = `The phpcs executable was not found for ${resource}. Sniffer is being disabled for this workspace.`;
    settings.snifferEnable = false;
  }
  if (
    settings.fixerEnable &&
    !(await executableExist(settings.executablePathCBF))
  ) {
    msg = `The phpcbf executable was not found for ${resource}. Fixer is being disabled for this workspace.`;
    settings.fixerEnable = false;
  }

  logger.log(msg);
  window.showWarningMessage(msg, 'OK');

  return settings;
};

export const loadSettings = async () => {
  const resourcesSettings: Array<ResourceSettings> = [];

  const globalConfig = workspace.getConfiguration('phpsab', null);
  const PHPconfig = workspace.getConfiguration('php', null);

  // Handle case where no workspace folders exist (single file mode).
  if (isSingleFileMode()) {
    const { displayName } = getExtensionInfo();

    const warningMsg = `No workspace folder open. ${displayName} will run with limited functionality. Please open a folder or workspace.`;

    logger.warn(warningMsg);
    window.showWarningMessage(warningMsg, 'OK');

    let settings = await getSettings(globalConfig);
    settings = await validate(settings, 'Single File Mode');

    resourcesSettings.push(settings);
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

      resourcesSettings.push(settings);
    }
  }

  // update settings from config
  let settings: Settings = {
    resources: resourcesSettings,
    snifferMode: globalConfig.get('snifferMode', 'onSave'),
    snifferShowSources: globalConfig.get('snifferShowSources', false),
    snifferShowFixabilityIcons: globalConfig.get(
      'snifferShowFixabilityIcons',
      true,
    ),
    snifferTypeDelay: globalConfig.get('snifferTypeDelay', 250),
    debug: globalConfig.get('debug', false),
    phpExecutablePath: await resolvePhpExecutablePath(globalConfig, PHPconfig),
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
