import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/actions';
import { createWorld, defaultConfig } from '../src/engine/world';

describe('changing your ruler name', () => {
  it('checks length, characters, uniqueness and a cooldown, and tells the realm', () => {
    const w = createWorld({ worldName: 'N', playerName: 'Old Name', villageName: 'Home', seed: 2, config: { ...defaultConfig(), aiCount: 3, size: 60 } });
    const me = w.players[w.humanId];
    const other = Object.values(w.players).find((p) => p.kind === 'ai')!;
    const r = (name: string) => applyAction(w, me.id, { type: 'renamePlayer', name });
    expect(r('ab').ok).toBe(false);
    expect(r('x'.repeat(25)).ok).toBe(false);
    expect(r('<script>').ok).toBe(false);
    expect(r(other.name.toUpperCase()).ok).toBe(false);
    expect(r('Barbarians').ok).toBe(false);
    expect(r('  Iron  Duke ').ok).toBe(true);
    expect(me.name).toBe('Iron Duke');
    expect(w.news[0].text).toBe('Old Name is now known as Iron Duke.');
    expect(r('Another Name').ok).toBe(false); // too soon
    me.renamedAt = Date.now() - 13 * 3_600_000;
    expect(r('Another Name').ok).toBe(true);
  });
});
