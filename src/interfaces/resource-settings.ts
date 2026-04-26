export interface ResourceSettings {
  workspaceRoot: string | null;
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
  excludeGlobs: string[];
  dockerEnabled: boolean;
  dockerContainer: string;
  dockerWorkspaceRoot: string;
  dockerExecutablePathCS: string;
  dockerExecutablePathCBF: string;
  dockerContainerExec: string;
  dockerUseFilepath: boolean;
}
