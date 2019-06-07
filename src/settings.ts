"use strict";

export interface Settings {
    fixerEnable: boolean;
    workspaceRoot: string;
    executablePathCBF: string;
    executablePathCS: string;
    composerJsonPath: string;
    standard: string | null;
    autoConfigSearch: boolean;
    allowedAutoRulesets: string[];
    debug: boolean;
    timeout: number;
    snifferEnable: boolean;
    snifferMode: string;
    snifferTypeDelay: number;
    snifferShowSources: boolean;
}
