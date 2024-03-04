export interface ResourceSettings {
  workspaceRoot: string;
  fixerEnable: boolean;
  fixerExecutablePath: string;
  fixerArguments: string[];
  snifferEnable: boolean;
  snifferExecutablePath: string;
  snifferArguments: string[];
  composerJsonPath: string;
  standard: string | null;
  autoRulesetSearch: boolean;
  allowedAutoRulesets: string[];
}

export interface Settings {
  resources: ResourceSettings[];
  debug: boolean;
  snifferMode: string;
  snifferTypeDelay: number;
  snifferShowSources: boolean;
}
