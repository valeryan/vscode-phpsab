import { ResourceSettings } from './resource-settings';

export type SnifferMode = 'onSave' | 'onType';

export interface Settings {
  resources: ResourceSettings[];
  debug: boolean;
  snifferMode: SnifferMode;
  snifferTypeDelay: number;
  snifferShowSources: boolean;
  snifferShowFixabilityIcons: boolean;
  phpExecutablePath: string;
}
