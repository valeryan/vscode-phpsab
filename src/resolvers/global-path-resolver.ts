/* --------------------------------------------------------------------------------------------
 * Copyright (c) Ioannis Kappas. All rights reserved.
 * Copyright (c) 2018 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import * as path from 'path';
import * as fs from 'fs';

import { PathResolverBase } from './path-resolver-base';

export class GlobalPathResolver extends PathResolverBase {
    protected executableFile: string;

    constructor (executable: string) {
        super();

		this.executableFile = executable;
    }
	async resolve(): Promise<string> {
		let resolvedPath: string | null = null;
		let pathSeparator = /^win/.test(process.platform) ? ";" : ":";
		const envPath = process.env.PATH === undefined ? '' : process.env.PATH;
		let globalPaths: string[] = envPath.split(pathSeparator);
		globalPaths.some((globalPath: string) => {
			let testPath = path.join(globalPath, this.executableFile);
			if (fs.existsSync(testPath)) {
				resolvedPath = testPath;
				return true;
			}
			return false;
		});

		return resolvedPath === null ? '' : resolvedPath;
	}
}
