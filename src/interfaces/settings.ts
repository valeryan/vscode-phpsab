export interface ResourceSettings {
  workspaceRoot: string;
  composerJsonPath: string;
  standard: string | null;
  autoRulesetSearch: boolean;
  allowedAutoRulesets: string[];
  fixerEnable: boolean;
  fixerExecutablePath: string;
  fixerArguments: string[];
  snifferEnable: boolean;
  snifferExecutablePath: string;
  snifferArguments: string[];
  snifferMode: string;
  snifferTypeDelay: number;
  snifferShowSources: boolean;
}

export interface Settings {
  workspaces: ResourceSettings[];
  debug: boolean;
}
