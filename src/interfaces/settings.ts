/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Samuel Hilson. All rights reserved.
 * Licensed under the MIT License. See License.md in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import { ResourceSettings } from "./resource-settings";

export interface Settings {
  resources: ResourceSettings[];
  debug: boolean;
  snifferMode: string;
  snifferTypeDelay: number;
  snifferShowSources: boolean;
}
