/**
 * Generate a short random alphanumeric ID.
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Generate symmetric noise centered at 0 within [-factor, +factor].
 */
export function symmetricNoise(factor: number): number {
  return (Math.random() - 0.5) * 2 * factor;
}
