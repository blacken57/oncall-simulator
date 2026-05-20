import { describe, it, expect } from 'vitest';
import { Attribute } from '../src/lib/game/base.svelte';
import type { AttributeConfig } from '../src/lib/game/schema';

function makeAttr(overrides: Partial<AttributeConfig> = {}): Attribute {
  return new Attribute({
    name: 'Test',
    unit: 'units',
    initialLimit: 10,
    minLimit: 1,
    maxLimit: 50,
    ...overrides
  });
}

describe('Attribute bounds enforcement', () => {
  it('should clamp limit to maxLimit when set above', () => {
    const attr = makeAttr();
    attr.limit = 100;
    expect(attr.limit).toBe(50);
  });

  it('should clamp limit to minLimit when set below', () => {
    const attr = makeAttr();
    attr.limit = 0;
    expect(attr.limit).toBe(1);
  });

  it('should accept limit within bounds', () => {
    const attr = makeAttr();
    attr.limit = 25;
    expect(attr.limit).toBe(25);
  });

  it('should clamp initialLimit in constructor', () => {
    const attr = makeAttr({ initialLimit: 999 });
    expect(attr.limit).toBe(50);
  });
});
