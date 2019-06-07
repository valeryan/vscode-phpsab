/* --------------------------------------------------------------------------------------------
 * Copyright (c) Ioannis Kappas. All rights reserved.
 * Copyright (c) Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import { PathResolverBase } from './path-resolver-base';
import { ComposerPathResolver } from './composer-path-resolver';
import { GlobalPathResolver } from './global-path-resolver';

export interface PathResolverOptions {
	workspaceRoot: string | null;
    composerJsonPath: string;
}

export class PathResolver extends PathResolverBase {
    protected executableFile: string;

	private resolvers: PathResolverBase[] = [];

	constructor(options: PathResolverOptions, executable: string) {
        super();
        this.executableFile = executable + this.extension;
		if (options.workspaceRoot !== null) {
			this.resolvers.push(new ComposerPathResolver(
                this.executableFile,
                options.workspaceRoot,
                options.composerJsonPath));
		}
		this.resolvers.push(new GlobalPathResolver(this.executableFile));
	}

	async resolve(): Promise<string> {
		let resolvedPath: string | null = null;
		for (var i = 0, len = this.resolvers.length; i < len; i++) {
			let resolverPath = await this.resolvers[i].resolve();
			if (resolvedPath !== resolverPath) {
				resolvedPath = resolverPath;
				break;
			}
		}

		if (resolvedPath === null) {
			throw new Error(`Unable to locate ${this.executableFile}. Please add ${this.executableFile} to your global path or use composer dependency manager to install it in your project locally.`);
		}

		return resolvedPath;
	}
}
