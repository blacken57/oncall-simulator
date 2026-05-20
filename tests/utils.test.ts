import { describe, it, expect } from 'vitest';
import { generateId, symmetricNoise } from '../src/lib/game/utils';

describe('generateId', () => {
  it('should return a 9-character string', () => {
    const id = generateId();
    expect(id).toHaveLength(9);
    expect(typeof id).toBe('string');
  });

  it('should return unique values across 100 calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('symmetricNoise', () => {
  it('should return values in [-factor, +factor]', () => {
    for (let i = 0; i < 1000; i++) {
      const v = symmetricNoise(5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('should return 0 when factor is 0', () => {
    // May return -0 due to floating point; both -0 and +0 are acceptable
    expect(Math.abs(symmetricNoise(0))).toBe(0);
  });
});
