import { describe, it, expect } from 'vitest';
import { applyEffects } from '../src/lib/game/base.svelte';

describe('applyEffects()', () => {
  it('returns baseValue unchanged with an empty effects array', () => {
    expect(applyEffects(100, [])).toBe(100);
  });

  it('applies a multiplier-only effect: baseValue + baseValue * multiplier', () => {
    // 100 + 100*0.5 = 150
    expect(applyEffects(100, [{ multiplier: 0.5, offset: 0 }])).toBe(150);
  });

  it('applies an offset-only effect: baseValue + offset', () => {
    expect(applyEffects(100, [{ multiplier: 0, offset: 20 }])).toBe(120);
  });

  it('applies both multiplier and offset in a single effect', () => {
    // 100 + 100*0.5 + 20 = 170
    expect(applyEffects(100, [{ multiplier: 0.5, offset: 20 }])).toBe(170);
  });

  it('stacks multipliers additively across multiple effects', () => {
    // Two {multiplier: 0.5} effects → multSum = 1.0
    // 100 + 100*1.0 = 200, NOT (100*1.5*1.5 = 225)
    expect(
      applyEffects(100, [
        { multiplier: 0.5, offset: 0 },
        { multiplier: 0.5, offset: 0 }
      ])
    ).toBe(200);
  });

  it('applies a negative multiplier to reduce the result', () => {
    // 100 + 100*(-0.5) = 50
    expect(applyEffects(100, [{ multiplier: -0.5, offset: 0 }])).toBe(50);
  });

  it('two negative multipliers of -0.5 each cancel out the base value', () => {
    // multSum = -1.0 → 100 + 100*(-1.0) = 0
    expect(
      applyEffects(100, [
        { multiplier: -0.5, offset: 0 },
        { multiplier: -0.5, offset: 0 }
      ])
    ).toBe(0);
  });

  it('offset can push result below 0 (no clamping inside applyEffects)', () => {
    expect(applyEffects(10, [{ multiplier: 0, offset: -50 }])).toBe(-40);
  });

  it('stacks offsets additively across multiple effects', () => {
    // 100 + 0 + (10 + 15) = 125
    expect(
      applyEffects(100, [
        { multiplier: 0, offset: 10 },
        { multiplier: 0, offset: 15 }
      ])
    ).toBe(125);
  });
});
