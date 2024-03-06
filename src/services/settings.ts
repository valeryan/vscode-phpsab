import { ResourceSettings, Settings } from '@phpsab/interfaces/settings';
import { resolveExecutablePath } from '@phpsab/resolvers/executable-path-resolver';
import {
  crossPath,
  executableExist,
  getPlatformExtension,
} from '@phpsab/resolvers/path-resolver-utils';
import { logger } from '@phpsab/services/logger';
import { Uri, commands, window, workspace } from 'vscode';

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
const resolveFixerExecutablePath = async (
  settings: ResourceSettings,
  resourceName: string,
): Promise<ResourceSettings> => {
  if (!settings.fixerEnable) {
    return settings;
  }
  const ext = getPlatformExtension();
  // Handle fixing configured path for os platform
  if (settings.fixerExecutablePath) {
    const path = crossPath(settings.fixerExecutablePath);
    settings.fixerExecutablePath = path + ext;
  }

  // Attempt to auto resolve sniffer executable
  if (!settings.fixerExecutablePath) {
    let resolvedPath = await resolveExecutablePath(settings, `phpcbf${ext}`);
    settings.fixerExecutablePath = resolvedPath;
  }

  // Validate Exe
  if (!(await executableExist(settings.fixerExecutablePath))) {
    logger.log(`The phpcbf executable was not found for ${resourceName}`);
    settings.fixerEnable = false;
  }
  return settings;
};

/**
 * Get correct executable path from resolver
 * @param settings
 */
const resolveSnifferExecutablePath = async (
  settings: ResourceSettings,
  resourceName: string,
): Promise<ResourceSettings> => {
  if (!settings.snifferEnable) {
    return settings;
  }
  const ext = getPlatformExtension();
  // Handle fixing configured path for os platform
  if (settings.snifferExecutablePath) {
    const path = crossPath(settings.snifferExecutablePath);
    settings.snifferExecutablePath = path + ext;
  }

  // Attempt to auto resolve sniffer executable
  if (!settings.snifferExecutablePath) {
    let resolvedPath = await resolveExecutablePath(settings, `phpcs${ext}`);
    settings.snifferExecutablePath = resolvedPath;
  }

  // Validate Exe
  if (!(await executableExist(settings.snifferExecutablePath))) {
    logger.log(`The phpcs executable was not found for ${resourceName}`);
    settings.snifferEnable = false;
  }
  return settings;
};

/**
 * Alert user about deprecated settings
 * @param settingName Name of deprecated setting
 * @param replacement Name of the setting that replaces this setting
 */
const checkDeprecatedSettings = async (
  settingName: string,
  replacement?: string,
) => {
  const fullSettingName = `phpsab.${settingName}`;
  const deprecatedWorkspaces: { source: string; value: string }[] = [];

  const inspectResults = workspace.getConfiguration().inspect(fullSettingName);

  if (inspectResults) {
    // Check user and workspace levels
    if (typeof inspectResults.globalValue === 'string') {
      deprecatedWorkspaces.push({
        source: 'User',
        value: inspectResults.globalValue,
      });
    }
    if (typeof inspectResults.workspaceValue === 'string') {
      deprecatedWorkspaces.push({
        source: 'Workspace',
        value: inspectResults.workspaceValue,
      });
    }
  }

  // Loop through workspace folders
  if (workspace.workspaceFolders) {
    for (const workspaceFolder of workspace.workspaceFolders) {
      const resource = workspaceFolder.uri;
      const inspectResultsFolder = workspace
        .getConfiguration('phpsab', resource)
        .inspect(settingName);

      if (
        inspectResultsFolder &&
        typeof inspectResultsFolder.workspaceFolderValue === 'string'
      ) {
        deprecatedWorkspaces.push({
          source: 'Workspace Folder',
          value: inspectResultsFolder.workspaceFolderValue,
        });
        break; // This only needs to be added once because of forced folder select dialog
      }
    }
  }

  // Construct and display information message with links
  if (deprecatedWorkspaces.length > 0) {
    const message = `The setting ${settingName} is deprecated. `;
    let actionMessage = '';
    if (replacement) {
      actionMessage = `Please reset this setting, and use ${replacement} instead. `;
    } else {
      actionMessage = `Please remove or reset the setting. `;
    }
    const items = deprecatedWorkspaces.map(({ source, value }) => ({
      title: `Open ${source} Settings`,
      description: `Setting Value: ${value}`,
      action: () => openSettings(source, fullSettingName),
    }));

    const selectedAction = await window.showInformationMessage(
      `${message}${actionMessage}`,
      ...items,
    );
    if (selectedAction) {
      await selectedAction.action();
    }
  }
};

/**
 * Open a setting using query
 * @param source Source of the setting
 * @param settingName Name of setting that we are opening to
 */
const openSettings = async (source: string, settingName: string) => {
  switch (source) {
    case 'User':
      await commands.executeCommand(
        'workbench.action.openSettings',
        settingName,
      );
      break;
    case 'Workspace':
      await commands.executeCommand(
        'workbench.action.openWorkspaceSettings',
        settingName,
      );
      break;
    case 'Workspace Folder':
      await commands.executeCommand('workbench.action.openFolderSettings', {
        query: settingName,
      });
      break;
    default:
      logger.info('Unknown Settings Source');
      break;
  }
};

/**
 * Load all the extension settings
 * @returns Settings
 */
export const loadSettings = async () => {
  if (!workspace.workspaceFolders) {
    throw new Error('Unable to load configuration.');
  }
  const resourcesSettings: Array<ResourceSettings> = [];

  // Handle per Workspace settings
  for (let index = 0; index < workspace.workspaceFolders.length; index++) {
    const resource = workspace.workspaceFolders[index].uri;
    const resourceName = workspace.workspaceFolders[index].name;
    const config = workspace.getConfiguration('phpsab', resource);
    const rootPath = resolveRootPath(resource);

    // Load configured or defaults
    let settings: ResourceSettings = {
      workspaceRoot: rootPath,
      composerJsonPath: crossPath(
        config.get('composerJsonPath', 'composer.json'),
      ),
      standard: config.get('standard', ''),
      autoRulesetSearch: config.get('autoRulesetSearch', true),
      allowedAutoRulesets: config.get('allowedAutoRulesets', [
        '.phpcs.xml',
        'phpcs.xml',
        'phpcs.dist.xml',
        'ruleset.xml',
      ]),
      snifferEnable: config.get('snifferEnable', true),
      snifferExecutablePath: config.get('snifferExecutablePath', ''),
      snifferArguments: config.get('snifferArguments', []),
      snifferMode: config.get('snifferMode', 'onSave'),
      snifferShowSources: config.get('snifferShowSources', false),
      snifferTypeDelay: config.get('snifferTypeDelay', 250),
      fixerEnable: config.get('fixerEnable', true),
      fixerExecutablePath: config.get('fixerExecutablePath', ''),
      fixerArguments: config.get('fixerArguments', []),
    };

    settings = await resolveSnifferExecutablePath(settings, resourceName);
    settings = await resolveFixerExecutablePath(settings, resourceName);

    resourcesSettings.splice(index, 0, settings);
  }

  // update settings from config
  const config = workspace.getConfiguration('phpsab');
  let settings: Settings = {
    workspaces: resourcesSettings,
    debug: config.get('debug', false),
  };

  logger.setDebugMode(settings.debug);
  logger.debug('CONFIGURATION', settings);

  // Check for deprecated settings
  await checkDeprecatedSettings('executablePathCS', 'snifferExecutablePath');
  await checkDeprecatedSettings('executablePathCBF', 'fixerExecutablePath');
  return settings;
};
