import { ResourceSettings, Settings } from '@phpsab/interfaces/settings';
import { createPathResolver } from '@phpsab/resolvers/path-resolver';
import {
  crossPath,
  executableExist,
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
): Promise<ResourceSettings> => {
  // If fixerExecutablePath is set, transform path for cross platform, and validate, disable resolving.
  if (settings.fixerExecutablePath) {
    settings.fixerExecutablePath = crossPath(settings.fixerExecutablePath);
    return settings;
  }

  // Attempt to auto resolve fixer executable
  let executablePathResolver = createPathResolver(settings, 'phpcbf');
  settings.fixerExecutablePath = await executablePathResolver.resolve();
  return settings;
};

/**
 * Get correct executable path from resolver
 * @param settings
 */
const resolveSnifferExecutablePath = async (
  settings: ResourceSettings,
): Promise<ResourceSettings> => {
  // If snifferExecutablePath is set, transform path for cross platform, and validate, disable resolving.
  if (settings.snifferExecutablePath) {
    settings.snifferExecutablePath = crossPath(settings.snifferExecutablePath);
    return settings;
  }
  // Attempt to auto resolve sniffer executable
  let executablePathResolver = createPathResolver(settings, 'phpcs');
  settings.snifferExecutablePath = await executablePathResolver.resolve();
  return settings;
};

const validate = async (
  settings: ResourceSettings,
  resource: string,
): Promise<ResourceSettings> => {
  if (
    settings.snifferEnable &&
    !(await executableExist(settings.snifferExecutablePath))
  ) {
    logger.log(`The phpcs executable was not found for ${resource}`);
    settings.snifferEnable = false;
  }
  if (
    settings.fixerEnable &&
    !(await executableExist(settings.fixerExecutablePath))
  ) {
    logger.log(`The phpcbf executable was not found for ${resource}`);
    settings.fixerEnable = false;
  }
  return settings;
};

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

export const loadSettings = async () => {
  if (!workspace.workspaceFolders) {
    throw new Error('Unable to load configuration.');
  }
  const resourcesSettings: Array<ResourceSettings> = [];

  // Handle per Workspace settings
  for (let index = 0; index < workspace.workspaceFolders.length; index++) {
    const resource = workspace.workspaceFolders[index].uri;
    const config = workspace.getConfiguration('phpsab', resource);
    const rootPath = resolveRootPath(resource);
    let settings: ResourceSettings = {
      fixerEnable: config.get('fixerEnable', true),
      fixerArguments: config.get('fixerArguments', []),
      workspaceRoot: rootPath,
      fixerExecutablePath: config.get('fixerExecutablePath', ''),
      snifferExecutablePath: config.get('snifferExecutablePath', ''),
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

    settings = await resolveFixerExecutablePath(settings);
    settings = await resolveSnifferExecutablePath(settings);

    settings = await validate(settings, workspace.workspaceFolders[index].name);

    resourcesSettings.splice(index, 0, settings);
  }

  // update settings from config
  const config = workspace.getConfiguration('phpsab');
  let settings: Settings = {
    resources: resourcesSettings,
    snifferMode: config.get('snifferMode', 'onSave'),
    snifferShowSources: config.get('snifferShowSources', false),
    snifferTypeDelay: config.get('snifferTypeDelay', 250),
    debug: config.get('debug', false),
  };

  logger.setDebugMode(settings.debug);
  logger.debug('CONFIGURATION', settings);

  // Check for deprecated settings
  await checkDeprecatedSettings('executablePathCS', 'snifferExecutablePath');
  await checkDeprecatedSettings('executablePathCBF', 'fixerExecutablePath');
  return settings;
};
