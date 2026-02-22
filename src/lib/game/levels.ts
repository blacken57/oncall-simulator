import level1 from '../../data/level1.json';
import tutorial from '../../data/tutorial.json';
import type { LevelConfig } from './schema';

export const levels: Record<string, LevelConfig> = {
  tutorial: tutorial as unknown as LevelConfig,
  'level-1': level1 as unknown as LevelConfig
};

export function getLevel(id: string): LevelConfig | undefined {
  return levels[id];
}

export function getAllLevels(): LevelConfig[] {
  return Object.values(levels);
}
