import fs from 'node:fs/promises';
import path from 'node:path';
import { Uri, workspace } from 'vscode';
import { ResourceSettings } from './interfaces/resource-settings';
import { Settings } from './interfaces/settings';
import { logger } from './logger';
import { createPathResolver } from './resolvers/path-resolver';

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

    settings = await validate(settings, workspace.workspaceFolders[index].name);

    resourcesSettings.splice(index, 0, settings);
  }

  // update settings from config
  const config = workspace.getConfiguration('phpsab');
  const PHPconfig = workspace.getConfiguration('php');

  let settings: Settings = {
    resources: resourcesSettings,
    snifferMode: config.get('snifferMode', 'onSave'),
    snifferShowSources: config.get('snifferShowSources', false),
    snifferTypeDelay: config.get('snifferTypeDelay', 250),
    debug: config.get('debug', false),
    phpExecutablePath: await resolvePhpExecutablePath(config, PHPconfig),
  };

  logger.setDebugMode(settings.debug);
  logger.debug('CONFIGURATION', settings);

  return settings;
};
