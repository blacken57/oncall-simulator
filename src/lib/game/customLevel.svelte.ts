import type { LevelConfig } from './schema';

class CustomLevelStore {
  config = $state<LevelConfig | null>(null);
}

export const customLevelStore = new CustomLevelStore();
