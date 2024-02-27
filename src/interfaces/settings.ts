import { ResourceSettings } from './resource-settings';

export interface Settings {
  resources: ResourceSettings[];
  debug: boolean;
  snifferMode: string;
  snifferTypeDelay: number;
  snifferShowSources: boolean;
}
