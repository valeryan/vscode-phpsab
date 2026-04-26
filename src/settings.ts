import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Uri, WorkspaceConfiguration, window, workspace } from 'vscode';
import { ResourceSettings } from './interfaces/resource-settings';
import { Settings } from './interfaces/settings';
import { logger } from './logger';
import {
  isHostPathInsideWorkspace,
  toContainerPath,
} from './resolvers/docker-path-resolver';
import { createPathResolver } from './resolvers/path-resolver';
import {
  addPhpToEnvPath,
  joinPaths,
  normalizePath,
} from './resolvers/path-resolver-utils';
import {
  constructCommandString,
  getExtensionInfo,
  parseArgs,
} from './utils/helpers';

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
 * Whether the resource has an explicit container-side phpcbf path the
 * extension can use directly without resolving anything on the host.
 */
const hasExplicitDockerCBF = (settings: ResourceSettings): boolean =>
  settings.dockerEnabled && settings.dockerExecutablePathCBF.length > 0;

/**
 * Whether the resource has an explicit container-side phpcs path the
 * extension can use directly without resolving anything on the host.
 */
const hasExplicitDockerCS = (settings: ResourceSettings): boolean =>
  settings.dockerEnabled && settings.dockerExecutablePathCS.length > 0;

const deriveDockerExecutablePath = (
  settings: ResourceSettings,
  hostExecutablePath: string,
): string => {
  if (
    !hostExecutablePath ||
    !settings.workspaceRoot ||
    !settings.dockerWorkspaceRoot ||
    !isHostPathInsideWorkspace(hostExecutablePath, settings.workspaceRoot)
  ) {
    return '';
  }

  return toContainerPath(
    hostExecutablePath,
    settings.workspaceRoot,
    settings.dockerWorkspaceRoot,
  );
};

/**
 * Get correct executable path from resolver
 * @param settings
 */
const resolveCBFExecutablePath = async (
  settings: ResourceSettings,
): Promise<ResourceSettings> => {
  // Docker mode with an explicit container path: don't resolve anything on the host.
  if (hasExplicitDockerCBF(settings)) {
    return settings;
  }

  // If no path is set, try and find it via the path resolver.
  if (!settings.executablePathCBF) {
    let executablePathResolver = createPathResolver(settings, 'phpcbf');
    try {
      settings.executablePathCBF = await executablePathResolver.resolve();
    } catch (error) {
      // In Docker mode without an explicit container path, an unresolved host
      // path is fatal: we have nothing to remap into the container.
      if (settings.dockerEnabled) {
        settings.executablePathCBF = '';
      } else {
        throw error;
      }
    }
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

  // In Docker mode without an explicit container path, derive one from the host
  // path by remapping the workspace root prefix into the container.
  if (settings.dockerEnabled && !settings.dockerExecutablePathCBF) {
    settings.dockerExecutablePathCBF = deriveDockerExecutablePath(
      settings,
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
  if (hasExplicitDockerCS(settings)) {
    return settings;
  }

  // If no path is set, try and find it via the path resolver.
  if (!settings.executablePathCS) {
    let executablePathResolver = createPathResolver(settings, 'phpcs');
    try {
      settings.executablePathCS = await executablePathResolver.resolve();
    } catch (error) {
      if (settings.dockerEnabled) {
        settings.executablePathCS = '';
      } else {
        throw error;
      }
    }
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

  if (settings.dockerEnabled && !settings.dockerExecutablePathCS) {
    settings.dockerExecutablePathCS = deriveDockerExecutablePath(
      settings,
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

/**
 * Probe whether a given path exists as a regular file inside the configured
 * Docker container by running `<containerExec> exec -i <container> test -f <path>`.
 *
 * Returns `true` only when the probe runs and `test -f` succeeds (exit 0).
 */
const dockerExecutableExist = (
  containerPath: string,
  settings: ResourceSettings,
): boolean => {
  if (
    !containerPath ||
    !settings.dockerContainer ||
    !settings.dockerContainerExec
  ) {
    return false;
  }

  const command = constructCommandString(
    settings.dockerContainerExec,
    parseArgs([
      'exec',
      '-i',
      settings.dockerContainer,
      'test',
      '-f',
      containerPath,
    ]),
  );

  try {
    const result = spawnSync(command, {
      cwd: settings.workspaceRoot ?? undefined,
      env: process.env,
      encoding: 'utf8',
      shell: true,
      timeout: 5000,
    });

    if (result.error) {
      logger.debug(
        `Docker probe for "${containerPath}" failed: ${result.error.message}`,
      );
      return false;
    }

    return result.status === 0;
  } catch (error) {
    logger.debug(
      `Docker probe for "${containerPath}" threw: ${(error as Error).message}`,
    );
    return false;
  }
};

/**
 * Make sure the resource has the minimum Docker configuration the rest of
 * the pipeline relies on. Disables both tools and returns a warning string
 * (or `''`) on misconfiguration.
 */
const validateDockerConfig = (
  settings: ResourceSettings,
  resource: string,
): string => {
  if (!settings.dockerEnabled) {
    return '';
  }

  const missing: string[] = [];
  if (!settings.workspaceRoot) {
    missing.push(
      'a workspace folder (Docker mode is not supported in single-file mode)',
    );
  }
  if (!settings.dockerContainer) {
    missing.push('"phpsab.dockerContainer"');
  }
  if (!settings.dockerWorkspaceRoot) {
    missing.push('"phpsab.dockerWorkspaceRoot"');
  }
  if (!settings.dockerContainerExec) {
    missing.push('"phpsab.dockerContainerExec"');
  }

  if (missing.length === 0) {
    return '';
  }

  settings.snifferEnable = false;
  settings.fixerEnable = false;
  return `Docker mode is enabled for "${resource}" but is missing required settings: ${missing.join(', ')}. Sniffer and Fixer are being disabled for this workspace.`;
};

const validate = async (
  settings: ResourceSettings,
  resource: string,
): Promise<ResourceSettings> => {
  const warnings: string[] = [];

  // Docker config sanity check first; if it fails the host checks would be misleading.
  const dockerConfigWarning = validateDockerConfig(settings, resource);
  if (dockerConfigWarning) {
    warnings.push(dockerConfigWarning);
  }

  if (settings.dockerEnabled) {
    if (settings.snifferEnable) {
      const csPath = settings.dockerExecutablePathCS;
      if (!csPath) {
        warnings.push(
          `Could not determine a phpcs path inside container "${settings.dockerContainer}" for ${resource}. Set "phpsab.dockerExecutablePathCS" or place phpcs under the mounted workspace. Sniffer is being disabled for this workspace.`,
        );
        settings.snifferEnable = false;
      } else if (!dockerExecutableExist(csPath, settings)) {
        warnings.push(
          `Failed to verify phpcs in container "${settings.dockerContainer}" at "${csPath}" for ${resource}. Sniffer is being disabled for this workspace.`,
        );
        settings.snifferEnable = false;
      }
    }
    if (settings.fixerEnable) {
      const cbfPath = settings.dockerExecutablePathCBF;
      if (!cbfPath) {
        warnings.push(
          `Could not determine a phpcbf path inside container "${settings.dockerContainer}" for ${resource}. Set "phpsab.dockerExecutablePathCBF" or place phpcbf under the mounted workspace. Fixer is being disabled for this workspace.`,
        );
        settings.fixerEnable = false;
      } else if (!dockerExecutableExist(cbfPath, settings)) {
        warnings.push(
          `Failed to verify phpcbf in container "${settings.dockerContainer}" at "${cbfPath}" for ${resource}. Fixer is being disabled for this workspace.`,
        );
        settings.fixerEnable = false;
      }
    }
  } else {
    if (
      settings.snifferEnable &&
      !(await executableExist(settings.executablePathCS))
    ) {
      warnings.push(
        `The phpcs executable was not found for ${resource}. Sniffer is being disabled for this workspace.`,
      );
      settings.snifferEnable = false;
    }
    if (
      settings.fixerEnable &&
      !(await executableExist(settings.executablePathCBF))
    ) {
      warnings.push(
        `The phpcbf executable was not found for ${resource}. Fixer is being disabled for this workspace.`,
      );
      settings.fixerEnable = false;
    }
  }

  for (const msg of warnings) {
    logger.log(msg);
    window.showWarningMessage(msg, 'OK');
  }

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
    excludeGlobs: config.get('excludeGlobs', [
      '**/vendor/**',
      '**/node_modules/**',
    ]),
    dockerEnabled: config.get('dockerEnabled', false),
    dockerContainer: config.get('dockerContainer', ''),
    dockerWorkspaceRoot: config.get('dockerWorkspaceRoot', ''),
    dockerExecutablePathCS: config.get('dockerExecutablePathCS', ''),
    dockerExecutablePathCBF: config.get('dockerExecutablePathCBF', ''),
    dockerContainerExec: config.get('dockerContainerExec', 'docker'),
    dockerUseFilepath: config.get('dockerUseFilepath', false),
  };

  settings = await resolveCBFExecutablePath(settings);
  settings = await resolveCSExecutablePath(settings);

  return settings;
};

/**
 * Check PHPCS version compatibility.
 * @param {Settings} settings The extension settings
 * @return {Promise<void>}
 */
const checkPhpcsVersionCompatibility = async (
  settings: Settings,
): Promise<void> => {
  // Check version compatibility for each workspace resource
  for (const resourceSettings of settings.resources) {
    let phpcsVersion: string | null = null;
    let phpcbfVersion: string | null = null;
    const resourceRoot = path.basename(resourceSettings.workspaceRoot || '');

    // If sniffer is enabled and PHPCS executable found, check it's version.
    if (resourceSettings.snifferEnable) {
      phpcsVersion = await getPhpcsVersionForResource(
        resourceSettings,
        'PHPCS',
      );
    }

    // If fixer is enabled and PHPCBF executable found, check it's version.
    if (resourceSettings.fixerEnable) {
      phpcbfVersion = await getPhpcsVersionForResource(
        resourceSettings,
        'PHPCBF',
      );
    }

    let warningMsg = '';

    // Check for version detection issues

    // If neither version could be determined AND sniffer or fixer is enabled, warn the user.
    if (
      !phpcsVersion &&
      !phpcbfVersion &&
      resourceSettings.snifferEnable &&
      resourceSettings.fixerEnable
    ) {
      warningMsg = `Could not determine version of PHPCS/PHPCBF from "${resourceRoot}". Please ensure the executables are working correctly.`;
    }
    // If PHPCS version could not be determined AND sniffer is enabled, warn the user.
    else if (!phpcsVersion && resourceSettings.snifferEnable) {
      warningMsg = `Could not determine version of PHPCS from "${resourceRoot}". Please ensure the executable is working correctly.`;
    }
    // If PHPCBF version could not be determined AND fixer is enabled, warn the user.
    else if (!phpcbfVersion && resourceSettings.fixerEnable) {
      warningMsg = `Could not determine version of PHPCBF from "${resourceRoot}". Please ensure the executable is working correctly.`;
    }
    // Check for version mismatches when both versions are available
    else if (phpcsVersion && phpcbfVersion && phpcsVersion !== phpcbfVersion) {
      warningMsg = `Version mismatch detected: PHPCS version ${phpcsVersion} and PHPCBF version ${phpcbfVersion} from "${resourceRoot}". This may lead to unexpected behavior. Please ensure both are from the same installation directory.`;
    }

    // Only show warning if there's a message to display.
    if (warningMsg) {
      logger.warn(warningMsg);
      window.showWarningMessage(warningMsg, 'OK');
    }
  }
};

/**
 * Resolve and run `--version` for either tool, host- or container-side
 * depending on the resource configuration.
 */
const getPhpcsVersionForResource = async (
  resourceSettings: ResourceSettings,
  executableName: 'PHPCS' | 'PHPCBF',
): Promise<string | null> => {
  if (resourceSettings.dockerEnabled) {
    const containerExecutable =
      executableName === 'PHPCS'
        ? resourceSettings.dockerExecutablePathCS
        : resourceSettings.dockerExecutablePathCBF;

    if (!containerExecutable) {
      return null;
    }

    return getDockerPhpcsVersion(
      resourceSettings,
      containerExecutable,
      executableName,
    );
  }

  const hostExecutable =
    executableName === 'PHPCS'
      ? resourceSettings.executablePathCS
      : resourceSettings.executablePathCBF;
  return getPhpcsVersion(hostExecutable, executableName);
};

/**
 * Get the version of PHPCS or PHPCBF
 * @param {string} executablePath The path to the PHPCS or PHPCBF executable
 * @param {string} executableName The name of the executable (phpcs or phpcbf) for logging
 * @returns {Promise<string | null>} The version string or null if it couldn't be determined
 */
const getPhpcsVersion = async (
  executablePath: string,
  executableName: string,
): Promise<string | null> => {
  // If no executable path is provided, return null.
  if (!executablePath) {
    return null;
  }

  const command = constructCommandString(
    executablePath,
    parseArgs(['--version']),
  );
  return runVersionProbe(command, executableName);
};

/**
 * Run `--version` against an executable inside a Docker container.
 */
const getDockerPhpcsVersion = async (
  resourceSettings: ResourceSettings,
  containerExecutable: string,
  executableName: string,
): Promise<string | null> => {
  if (
    !resourceSettings.dockerContainer ||
    !resourceSettings.dockerContainerExec
  ) {
    return null;
  }

  const command = constructCommandString(
    resourceSettings.dockerContainerExec,
    parseArgs([
      'exec',
      '-i',
      resourceSettings.dockerContainer,
      containerExecutable,
      '--version',
    ]),
  );
  return runVersionProbe(command, executableName);
};

const runVersionProbe = (
  command: string,
  executableName: string,
): string | null => {
  try {
    const result = spawnSync(command, {
      encoding: 'utf8',
      shell: true,
      timeout: 5000,
    });

    if (result.status !== 0 || result.error) {
      logger.debug(
        `Failed to get ${executableName} version: ${result.error?.message || result.stderr}`,
      );
      return null;
    }

    const output = result.stdout.toString().trim();

    if (!output.includes('PHP_CodeSniffer')) {
      logger.debug(`Invalid output string for ${executableName}: ${output}`);
      return null;
    }

    const versionMatch = output.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!versionMatch) {
      logger.debug(
        `Could not obtain ${executableName} version from output:`,
        output,
      );
      return null;
    }

    const version = versionMatch[0];
    logger.info(`${executableName} version: ${version}`);
    return version;
  } catch (error) {
    const errorMsg = `Exception while getting the ${executableName} version: ${error}`;
    logger.debug(errorMsg);
    return null;
  }
};
