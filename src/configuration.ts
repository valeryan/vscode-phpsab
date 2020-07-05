/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import * as path from "path";
import { Settings } from "./interfaces/settings";
import { ResourceSettings } from "./interfaces/resource-settings";
import { PathResolver } from "./resolvers/path-resolver";
import { workspace, window, WorkspaceConfiguration, Uri } from "vscode";

export class Configuration {
    /**
     * Load from configuration
     */
    public async load() {
        let config: WorkspaceConfiguration;
        let rootPath: string;

        const editor = window.activeTextEditor;
        if (!editor || !workspace.workspaceFolders) {
            throw new Error("Unable to load configuration.");
        }
        const resource = editor.document.uri;
        config = workspace.getConfiguration("phpsab", resource);
        rootPath = this.resolveRootPath(resource);
        const resourcesSettings: Array<ResourceSettings> = [];

        for (let index = 0; index < workspace.workspaceFolders.length; index++) {
            const resource = workspace.workspaceFolders[index].uri;
            const config = workspace.getConfiguration("phpsab", resource);
            const rootPath = this.resolveRootPath(resource);
            let settings: ResourceSettings = {
                fixerEnable: config.get("fixerEnable", true),
                workspaceRoot: rootPath,
                executablePathCBF: config.get("executablePathCBF", ""),
                executablePathCS: config.get("executablePathCS", ""),
                composerJsonPath: config.get("composerJsonPath", "composer.json"),
                standard: config.get("standard", ""),
                autoConfigSearch: config.get("autoConfigSearch", true),
                allowedAutoRulesets: config.get("allowedAutoRulesets", [
                    ".phpcs.xml",
                    "phpcs.xml",
                    "phpcs.dist.xml",
                    "ruleset.xml"
                ]),
                snifferEnable: config.get("snifferEnable", true)
            };

            settings = await this.resolveCBFExecutablePath(settings);
            settings = await this.resolveCSExecutablePath(settings);

            settings = await this.validate(settings);

            resourcesSettings.splice(index, 0, settings);
        }

        // update settings from config
        let settings: Settings = {
            resources: resourcesSettings,
            snifferMode: config.get("snifferMode", "onSave"),
            snifferShowSources: config.get("snifferShowSources", false),
            snifferTypeDelay: config.get("snifferTypeDelay", 250),
            debug: config.get("debug", false)
        };

        if (settings.debug) {
            console.log("----- PHPSAB CONFIGURATION -----");
            console.log(settings);
            console.log("----- PHPSAB CONFIGURATION END -----");
        }

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

    private async validate(settings: ResourceSettings): Promise<ResourceSettings> {
        if (settings.snifferEnable && !settings.executablePathCS) {
            settings.snifferEnable = false;
        }
        if (settings.fixerEnable && !settings.executablePathCBF) {
            settings.fixerEnable = false;
        }
        return settings;
    }
}
