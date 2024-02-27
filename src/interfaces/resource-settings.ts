export interface ResourceSettings {
  workspaceRoot: string;
  fixerEnable: boolean;
  fixerArguments: string[];
  snifferEnable: boolean;
  snifferArguments: string[];
  executablePathCBF: string;
  executablePathCS: string;
  composerJsonPath: string;
  standard: string | null;
  autoRulesetSearch: boolean;
  allowedAutoRulesets: string[];
}
