export type SnifferMode = 'onSave' | 'onType';

/**
 * Global settings
 */
export interface Settings {
  /**
   * The workspace-specific resource settings.
   */
  resources: ResourceSettings[];

  /**
   * Whether debug mode is enabled for the extension.
   */
  debug: boolean;

  /**
   * The mode in which the sniffer operates, either 'onSave' or 'onType'.
   */
  snifferMode: SnifferMode;

  /**
   * The delay in milliseconds for the sniffer when operating in 'onType' mode.
   */
  snifferTypeDelay: number;

  /**
   * Whether to show the sniff sources of issues.
   */
  snifferShowSources: boolean;

  /**
   * Whether to show fixability icons for sniffer issues.
   */
  snifferShowFixabilityIcons: boolean;

  /**
   * The path to the PHP executable.
   */
  phpExecutablePath: string;
}

/**
 * Workspace-specific resource settings
 */
export interface ResourceSettings {
  /**
   * The workspace root path.
   */
  workspaceRoot: string | null;

  /**
   * Whether the fixer is enabled.
   */
  fixerEnable: boolean;

  /**
   * The arguments to pass to the fixer.
   */
  fixerArguments: string[];

  /**
   * Whether the sniffer is enabled.
   */
  snifferEnable: boolean;

  /**
   * The arguments to pass to the sniffer.
   */
  snifferArguments: string[];

  /**
   * The path to the CBF executable.
   */
  executablePathCBF: string;

  /**
   * The path to the CS executable.
   */
  executablePathCS: string;

  /**
   * The path to the composer.json file.
   */
  composerJsonPath: string;

  /**
   * The coding standard to use.
   */
  standard: string | null;

  /**
   * Whether to automatically search for rulesets.
   */
  autoRulesetSearch: boolean;

  /**
   * The allowed auto-detected rulesets.
   */
  allowedAutoRulesets: string[];

  /**
   * The glob patterns to exclude files/directories from analysis.
   */
  excludeGlobs: string[];
}
