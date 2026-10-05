import { describe, expect, it } from 'vitest';
import { gunzip, gzip } from '../src/host/cloud';

describe('cloud saves', () => {
  it('pack a save small and bring it back intact', async () => {
    const text = JSON.stringify({ world: { villages: Array.from({ length: 2000 }, (_, i) => ({ id: i, name: `Village ${i}`, units: { spear: i } })) } });
    const packed = await gzip(text);
    expect(packed.length).toBeLessThan(text.length / 3);
    expect(await gunzip(packed)).toBe(text);
  });
});
