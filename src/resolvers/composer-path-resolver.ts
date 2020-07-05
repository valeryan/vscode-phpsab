/* --------------------------------------------------------------------------------------------
 * Copyright (c) Ioannis Kappas. All rights reserved.
 * Copyright (c) 2018 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import * as path from "path";
import * as fs from "fs";

import { PathResolverBase } from "./path-resolver-base";

export class ComposerPathResolver extends PathResolverBase {
    protected readonly _workspaceRoot: string;
    protected readonly _workingPath: string;

    protected _composerJsonPath!: string;
    protected _composerLockPath!: string;

    protected _executableFile: string;

    /**
     * Class constructor.
     *
     * @param executableFile The executable file.
     * @param workspaceRoot The workspace path.
     * @param composerJsonPath The path to composer.json.
     */
    constructor(
        executableFile: string,
        workspaceRoot: string,
        workingPath: string = ""
    ) {
        super();
        this._executableFile = executableFile;
        this._workspaceRoot = workspaceRoot;
        this._workingPath = path.isAbsolute(workingPath)
            ? workingPath
            : path
                  .join(workspaceRoot, workingPath)
                  .replace(/composer.json$/, "");
    }

    public get workspaceRoot(): string {
        return this._workspaceRoot;
    }

    public get workingPath(): string {
        return this._workingPath;
    }

    public get composerJsonPath(): string {
        if (!this._composerJsonPath) {
            this._composerJsonPath = fs.realpathSync(
                path.join(this.workingPath, "composer.json")
            );
        }
        return this._composerJsonPath;
    }

    public get composerLockPath(): string {
        if (!this._composerLockPath) {
            this._composerLockPath = fs.realpathSync(
                path.join(this.workingPath, "composer.lock")
            );
        }
        return this._composerLockPath;
    }

    /**
     * Determine whether composer.json exists at the root path.
     */
    hasComposerJson(): boolean {
        try {
            return fs.existsSync(this.composerJsonPath);
        } catch (error) {
            return false;
        }
    }

    /**
     * Determine whether composer.lock exists at the root path.
     */
    hasComposerLock(): boolean {
        try {
            return fs.existsSync(this.composerLockPath);
        } catch (error) {
            return false;
        }
    }

    /**
     * Determine whether phpcbf is set as a composer dependency.
     */
    hasComposerDependency(): boolean {
        // Safely load composer.lock
        let dependencies = null;
        try {
            dependencies = JSON.parse(
                fs.readFileSync(this.composerLockPath, "utf8")
            );
        } catch (error) {
            dependencies = {};
        }

        // Determine phpcbf dependency.
        let search = [];
        if (dependencies["packages-dev"]) {
            search.push(dependencies["packages-dev"]);
        }
        if (dependencies["packages"]) {
            search.push(dependencies["packages"]);
        }

        return search.some((pkgs) => {
            let match = pkgs.filter((pkg: any) => {
                return pkg.name === "squizlabs/php_codesniffer";
            });
            return match.length !== 0;
        });
    }

    /**
     * Get the composer vendor path.
     */
    getVendorPath(): string {
        let basePath = path.dirname(this.composerJsonPath);
        let vendorPath = path.join(
            basePath,
            "vendor",
            "bin",
            this._executableFile
        );

        // Safely load composer.json
        let config = null;
        try {
            config = JSON.parse(fs.readFileSync(this.composerJsonPath, "utf8"));
        } catch (error) {
            config = {};
        }

        // Check vendor-bin configuration
        if (config["config"] && config["config"]["vendor-dir"]) {
            vendorPath = path.join(
                basePath,
                config["config"]["vendor-dir"],
                "bin",
                this._executableFile
            );
        }

        // Check bin-bin configuration
        if (config["config"] && config["config"]["bin-dir"]) {
            vendorPath = path.join(
                basePath,
                config["config"]["bin-dir"],
                this._executableFile
            );
        }

        return vendorPath;
    }

    async resolve(): Promise<string> {
        let resolvedPath: string | null = null;
        if (this.workspaceRoot) {
            // Determine whether composer.json and composer.lock exist and phpcbf is defined as a dependency.
            if (
                this.hasComposerJson() &&
                this.hasComposerLock() &&
                this.hasComposerDependency()
            ) {
                let vendorPath = this.getVendorPath();
                if (fs.existsSync(vendorPath)) {
                    resolvedPath = vendorPath;
                } else {
                    let relativeVendorPath = path.relative(
                        this.workspaceRoot,
                        vendorPath
                    );
                    throw new Error(
                        `Composer phpcs dependency is configured but was not found under ${relativeVendorPath}. You may need to run "composer install" or set your executablePaths for phpcs & phpcbf manually.`
                    );
                }
            }
        }

        return resolvedPath === null ? "" : resolvedPath;
    }
}
