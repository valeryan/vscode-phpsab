/* --------------------------------------------------------------------------------------------
 * Copyright (c) Ioannis Kappas. All rights reserved.
 * Copyright (c) Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import * as fs from "fs";

import { PathResolverBase } from "./path-resolver-base";
import { TextDocument, workspace } from "vscode";
import { ResourceSettings } from "../interfaces/resource-settings";
import { Logger } from "../logger";

export class StandardsPathResolver extends PathResolverBase {
    constructor(
        private document: TextDocument,
        private config: ResourceSettings,
        private logger: Logger
    ) {
        super();
    }
    async resolve(): Promise<string> {
        let configured =
            this.config.standard !== null ? this.config.standard : "";
        if (this.config.autoRulesetSearch === false) {
            return configured;
        }

        let resolvedPath: string | null = null;
        const resource = this.document.uri;
        const folder = workspace.getWorkspaceFolder(resource);
        if (!folder) {
            return "";
        }
        let workspaceRoot = folder.uri.fsPath + this.pathSeparator;
        let localPath = resource.fsPath.replace(workspaceRoot, "");
        let paths = localPath
            .split(this.pathSeparator)
            .filter((path) => path.includes(".php") !== true);

        let searchPaths = [];

        // create search paths based on file location
        for (let i = 0, len = paths.length; i < len; i++) {
            searchPaths.push(
                workspaceRoot +
                    paths.join(this.pathSeparator) +
                    this.pathSeparator
            );
            paths.pop();
        }
        searchPaths.push(workspaceRoot);

        // check each search path for an allowed ruleset
        let allowed = this.config.allowedAutoRulesets;

        let files: string[] = [];

        searchPaths.map((path) => {
            allowed.forEach((file) => {
                files.push(path + file);
            });
        });
        this.logger.logInfo('Standards Search paths: ', searchPaths);

        for (let i = 0, len = files.length; i < len; i++) {
            let c = files[i];
            if (fs.existsSync(c)) {
                return (resolvedPath = c);
            }
        }

        return resolvedPath === null ? configured : resolvedPath;
    }
}
