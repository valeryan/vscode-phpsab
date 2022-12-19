/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import * as path from "path";
import * as fs from "fs";
import { Settings } from "./interfaces/settings";
import { Logger, LogLevel } from "./logger";
import { ResourceSettings } from "./interfaces/resource-settings";
import { PathResolver } from "./resolvers/path-resolver";
import { workspace, WorkspaceConfiguration, Uri } from "vscode";

export class Configuration {
    debug: boolean;
    config: WorkspaceConfiguration;

    constructor(private logger: Logger) {
        this.config = workspace.getConfiguration("phpsab");
        this.debug = this.config.get("debug", false);

        let logLevel: LogLevel = this.debug ? 'INFO' : 'ERROR';
        this.logger.setOutputLevel(logLevel);
    }

    /**
     * Load from configuration
     */
    public async load() {
        if (!workspace.workspaceFolders) {
            throw new Error("Unable to load configuration.");
        }

        const resourcesSettings: Array<ResourceSettings> = [];

        for (
            let index = 0;
            index < workspace.workspaceFolders.length;
            index++
        ) {
            const resource = workspace.workspaceFolders[index].uri;
            const config = workspace.getConfiguration("phpsab", resource);
            const rootPath = this.resolveRootPath(resource);
            let settings: ResourceSettings = {
                fixerEnable: config.get("fixerEnable", true),
                fixerArguments: config.get("fixerArguments", []),
                workspaceRoot: rootPath,
                executablePathCBF: config.get("executablePathCBF", ""),
                executablePathCS: config.get("executablePathCS", ""),
                composerJsonPath: config.get(
                    "composerJsonPath",
                    "composer.json"
                ),
                standard: config.get("standard", ""),
                autoRulesetSearch: config.get("autoRulesetSearch", true),
                allowedAutoRulesets: config.get("allowedAutoRulesets", [
                    ".phpcs.xml",
                    "phpcs.xml",
                    "phpcs.dist.xml",
                    "ruleset.xml",
                ]),
                snifferEnable: config.get("snifferEnable", true),
                snifferArguments: config.get("snifferArguments", []),
            };

            settings = await this.resolveCBFExecutablePath(settings);
            settings = await this.resolveCSExecutablePath(settings);

            settings = await this.validate(
                settings,
                workspace.workspaceFolders[index].name
            );

            resourcesSettings.splice(index, 0, settings);
        }

        // update settings from config
        let settings: Settings = {
            resources: resourcesSettings,
            snifferMode: this.config.get("snifferMode", "onSave"),
            snifferShowSources: this.config.get("snifferShowSources", false),
            snifferTypeDelay: this.config.get("snifferTypeDelay", 250),
            debug: this.debug,
        };
        this.logger.logInfo('CONFIGURATION', settings);
        return settings;
    }

    /**
     * Attempt to find the root path for a workspace or resource
     * @param resource
     */
    private resolveRootPath(resource: Uri) {
        // try to get a valid folder from resource
        let folder = workspace.getWorkspaceFolder(resource);

        // one last safety check
        return folder ? folder.uri.fsPath : "";
    }

    /**
     * Get correct executable path from resolver
     * @param settings
     */
    protected async resolveCBFExecutablePath(
        settings: ResourceSettings
    ): Promise<ResourceSettings> {
        if (settings.executablePathCBF === null) {
            let executablePathResolver = new PathResolver(settings, "phpcbf");
            settings.executablePathCBF = await executablePathResolver.resolve();
        } else if (
            !path.isAbsolute(settings.executablePathCBF) &&
            settings.workspaceRoot !== null
        ) {
            settings.executablePathCBF = path.join(
                settings.workspaceRoot,
                settings.executablePathCBF
            );
        }
        return settings;
    }

    /**
     * Get correct executable path from resolver
     * @param settings
     */
    protected async resolveCSExecutablePath(
        settings: ResourceSettings
    ): Promise<ResourceSettings> {
        if (settings.executablePathCS === null) {
            let executablePathResolver = new PathResolver(settings, "phpcs");
            settings.executablePathCS = await executablePathResolver.resolve();
        } else if (
            !path.isAbsolute(settings.executablePathCS) &&
            settings.workspaceRoot !== null
        ) {
            settings.executablePathCS = path.join(
                settings.workspaceRoot,
                settings.executablePathCS
            );
        }
        return settings;
    }

    private async validate(
        settings: ResourceSettings,
        resource: string
    ): Promise<ResourceSettings> {
        if (
            settings.snifferEnable &&
            !(await this.executableExist(settings.executablePathCS))
        ) {
            this.logger.logInfo("The phpcs executable was not found for " + resource);
            settings.snifferEnable = false;
        }
        if (
            settings.fixerEnable &&
            !(await this.executableExist(settings.executablePathCBF))
        ) {
            this.logger.logInfo("The phpcbf executable was not found for " + resource);
            settings.fixerEnable = false;
        }
        return settings;
    }

    private async executableExist(path: string) {
        if (!path) {
            return false;
        }
        if (fs.existsSync(path)) {
            return true;
        }
        return false;
    }
}
