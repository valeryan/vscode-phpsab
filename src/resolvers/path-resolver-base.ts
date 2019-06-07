/* --------------------------------------------------------------------------------------------
 * Copyright (c) Ioannis Kappas. All rights reserved.
 * Copyright (c) 2018 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

export abstract class PathResolverBase {
    protected extension: string;
	protected pathSeparator: string;

	constructor() {
		this.extension = /^win/.test(process.platform) ? ".bat" : "";
		this.pathSeparator = /^win/.test(process.platform) ? "\\" : "/";
	}

	abstract async resolve(): Promise<string>;
}
