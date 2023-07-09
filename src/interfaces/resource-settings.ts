/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

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
