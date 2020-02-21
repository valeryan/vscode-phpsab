"use strict";

import * as path from "path";
import { Settings } from "./settings";
import { PathResolver } from "./resolvers/path-resolver";
import { workspace, WorkspaceConfiguration, Uri } from "vscode";

export class Configuration {
    /**
     * Load from configuration
     */
    public async load() {
        let config: WorkspaceConfiguration;
        let rootPath: string;

        if (!workspace.workspaceFolders) {
            throw new Error("Unable to load configuration.");
        }

        const resource = workspace.workspaceFolders[0].uri;
        config = workspace.getConfiguration("phpsab", resource);
        rootPath = this.resolveRootPath(workspace, resource);

        // update settings from config
        let settings: Settings = {
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
            snifferEnable: config.get("snifferEnable", true),
            snifferMode: config.get("snifferMode", "onSave"),
            snifferShowSources: config.get("snifferShowSources", false),
            snifferTypeDelay: config.get("snifferTypeDelay", 250),
            debug: config.get("debug", false)
        };

        settings = await this.resolveCBFExecutablePath(settings);
        settings = await this.resolveCSExecutablePath(settings);

        settings = await this.validate(settings);

        if (settings.debug) {
            console.log("----- PHPSAB CONFIGURATION -----");
            console.log(settings);
            console.log("----- PHPSAB CONFIGURATION END -----");
        }

        return settings;
    }

    /**
     * Get correct executable path from resolver
     * @param settings
     */
    protected async resolveCBFExecutablePath(
        settings: Settings
    ): Promise<Settings> {
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
        settings: Settings
    ): Promise<Settings> {
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

    /**
     * Attempt to find the root path for a workspace or resource
     * @param workspace
     * @param resource
     */
    private resolveRootPath(workspace: any, resource: Uri) {
        // try to get a valid folder from resource
        let folder = workspace.getWorkspaceFolder(resource);
        // try to get a folder from workspace
        if (!folder) {
            folder = workspace.workspaceFolders.shift();
        }

        // one last safety check
        return folder ? folder.uri.fsPath : "";
    }

    private async validate(settings: Settings): Promise<Settings> {
        if (settings.snifferEnable && !settings.executablePathCS) {
            if (settings.debug) {
                console.error(
                    "Sniffer will be disable because phpcs could not be found."
                );
            }
            settings.snifferEnable = false;
        }
        if (settings.fixerEnable && !settings.executablePathCBF) {
            if (settings.debug) {
                console.error(
                    "Fixer will be disable because phpcbf could not be found."
                );
            }
            settings.fixerEnable = false;
        }
        return settings;
    }
}
