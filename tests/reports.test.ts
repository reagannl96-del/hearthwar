import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/actions';
import { ARCHIVE_CAP, REPORT_CAP, addReport } from '../src/engine/commands';
import { createWorld, defaultConfig } from '../src/engine/world';

function setup() {
  const w = createWorld({ worldName: 'R', playerName: 'P', villageName: 'Home', seed: 8, config: { ...defaultConfig(), aiCount: 2, size: 60 } });
  const p = w.players[w.humanId];
  p.reports = [];
  const add = (title: string) => addReport(w, p.id, { kind: 'info', title, color: 'blue' })!;
  return { w, p, add };
}

describe('the report archive', () => {
  it('keeps archived reports out of the inbox sweeps', () => {
    const { w, p, add } = setup();
    const a = add('keep me'), b = add('read one'), c = add('unread one');
    expect(applyAction(w, p.id, { type: 'archiveReport', id: a.id }).ok).toBe(true);
    expect(a.archived).toBe(true);
    expect(a.read).toBe(true);
    b.read = true;
    applyAction(w, p.id, { type: 'deleteReport', id: 'read' });
    expect(p.reports.map((r) => r.title).sort()).toEqual(['keep me', 'unread one']);
    applyAction(w, p.id, { type: 'deleteReport', id: 'all' });
    expect(p.reports.map((r) => r.title)).toEqual(['keep me']);
    expect(c).toBeTruthy();
    // taking it back out of the archive puts it in the inbox again, where sweeps reach it
    applyAction(w, p.id, { type: 'archiveReport', id: a.id, archived: false });
    expect(a.archived).toBeUndefined();
    applyAction(w, p.id, { type: 'deleteReport', id: 'all' });
    expect(p.reports).toHaveLength(0);
  });

  it('archives every read report at once, and a single report can still be deleted from the archive', () => {
    const { w, p, add } = setup();
    const r1 = add('one'), r2 = add('two'), r3 = add('three');
    r1.read = r2.read = true;
    applyAction(w, p.id, { type: 'archiveReport', id: 'read' });
    expect([r1.archived, r2.archived, r3.archived]).toEqual([true, true, undefined]);
    applyAction(w, p.id, { type: 'deleteReport', id: r1.id });
    expect(p.reports.map((r) => r.title).sort()).toEqual(['three', 'two']);
  });

  it('new reports never push archived ones out; the archive has its own limit', () => {
    const { w, p, add } = setup();
    const old = add('an old favourite');
    applyAction(w, p.id, { type: 'archiveReport', id: old.id });
    for (let i = 0; i < REPORT_CAP + 50; i++) add(`news ${i}`);
    expect(p.reports.filter((r) => !r.archived)).toHaveLength(REPORT_CAP);
    expect(p.reports.some((r) => r.id === old.id)).toBe(true);
    for (const r of p.reports) r.archived = true;
    add('one more');
    expect(p.reports.filter((r) => r.archived).length).toBeLessThanOrEqual(ARCHIVE_CAP);
  });
});
