import path from 'node:path';
import { Uri, WorkspaceConfiguration, window, workspace } from 'vscode';
import { checkPhpcsVersionCompatibility } from './compatibility';
import { ResourceSettings, Settings, SnifferMode } from './interfaces/settings';
import { logger } from './logger';
import { createPathResolver } from './resolvers/path-resolver';
import {
  addPhpToEnvPath,
  executableExist,
  expandHomeDir,
  joinPaths,
  normalizePath,
} from './resolvers/path-resolver-utils';
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
 * @param {Uri} resource The workspace resource URI
 * @returns {string} The resolved root path for the given resource,
 * or an empty string if none is found.
 */
const resolveRootPath = (resource: Uri): string => {
  // try to get a valid folder from resource
  let folder = workspace.getWorkspaceFolder(resource);

  // one last safety check
  return folder ? folder.uri.fsPath : '';
};

/**
 * Get correct executable path from resolver
 * @param {ResourceSettings} settings The resource settings.
 * @returns {Promise<ResourceSettings>} The resolved resource settings with the correct executable path.
 */
const resolveCBFExecutablePath = async (
  settings: ResourceSettings,
): Promise<ResourceSettings> => {
  // If no path is set, try and find it via the path resolver.
  if (!settings.executablePathCBF) {
    let executablePathResolver = createPathResolver(settings, 'phpcbf');
    settings.executablePathCBF = await executablePathResolver.resolve();
  } else {
    settings.executablePathCBF = expandHomeDir(settings.executablePathCBF);

    // If a relative path is set, resolve it against the workspace root.
    if (
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
  }

  return settings;
};

/**
 * Get correct executable path from resolver
 * @param {ResourceSettings} settings The resource settings.
 * @returns {Promise<ResourceSettings>} The resolved resource settings with the correct executable path.
 */
const resolveCSExecutablePath = async (
  settings: ResourceSettings,
): Promise<ResourceSettings> => {
  // If no path is set, try and find it via the path resolver.
  if (!settings.executablePathCS) {
    let executablePathResolver = createPathResolver(settings, 'phpcs');
    settings.executablePathCS = await executablePathResolver.resolve();
  } else {
    settings.executablePathCS = expandHomeDir(settings.executablePathCS);

    // If a relative path is set, resolve it against the workspace root.
    if (
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
  }

  return settings;
};

/**
 * Resolve PHP executable path with proper precedence handling
 * @param {WorkspaceConfiguration} config phpsab configuration
 * @param {WorkspaceConfiguration} phpConfig php configuration
 * @returns {Promise<string>} The resolved PHP executable path or an empty string if none is found.
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
    const expandedPath = source.path ? expandHomeDir(source.path) : source.path;
    // Return the first valid (non-empty) existing executable path found
    if (expandedPath && (await executableExist(expandedPath))) {
      logger.debug(`Using PHP executable from ${source.name}: ${expandedPath}`);
      return expandedPath;
    }
  }

  // If no executable path is found, return an empty string
  return '';
};

/**
 * Validate the resource-specific settings, ensuring that the configured
 * executable paths exist and disabling features if necessary.
 * @param settings The resource-specific settings to validate.
 * @param resource The resource (workspace folder or single file) for which the settings are being validated.
 * @returns {Promise<ResourceSettings>} The validated resource settings.
 */
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

  if (msg) {
    logger.log(msg);
    window.showWarningMessage(msg, 'OK');
  }

  return settings;
};

/**
 * Load and validate the extension settings.
 * @returns {Promise<Settings>} The loaded and validated settings.
 */
export const loadSettings = async (): Promise<Settings> => {
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
    snifferMode: globalConfig.get<SnifferMode>('snifferMode', 'onSave'),
    snifferShowSources: globalConfig.get<boolean>('snifferShowSources', false),
    snifferShowFixabilityIcons: globalConfig.get<boolean>(
      'snifferShowFixabilityIcons',
      true,
    ),
    snifferTypeDelay: globalConfig.get<number>('snifferTypeDelay', 250),
    debug: globalConfig.get<boolean>('debug', false),
    phpExecutablePath: await resolvePhpExecutablePath(globalConfig, PHPconfig),
  };

  if (settings.phpExecutablePath != '') {
    addPhpToEnvPath(settings.phpExecutablePath);
  }

  await checkPhpcsVersionCompatibility(settings);

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
    fixerEnable: config.get<boolean>('fixerEnable', true),
    fixerArguments: config.get<string[]>('fixerArguments', []),
    workspaceRoot: rootPath,
    executablePathCBF: config.get<string>('executablePathCBF', ''),
    executablePathCS: config.get<string>('executablePathCS', ''),
    composerJsonPath: config.get<string>('composerJsonPath', 'composer.json'),
    standard: config.get<string | null>('standard', ''),
    autoRulesetSearch: config.get<boolean>('autoRulesetSearch', true),
    allowedAutoRulesets: config.get<string[]>('allowedAutoRulesets', [
      '.phpcs.xml',
      'phpcs.xml',
      'phpcs.dist.xml',
      'ruleset.xml',
    ]),
    snifferEnable: config.get<boolean>('snifferEnable', true),
    snifferArguments: config.get<string[]>('snifferArguments', []),
    excludeGlobs: config.get<string[]>('excludeGlobs', [
      '**/vendor/**',
      '**/node_modules/**',
    ]),
  };

  settings = await resolveCBFExecutablePath(settings);
  settings = await resolveCSExecutablePath(settings);

  return settings;
};
