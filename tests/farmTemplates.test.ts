import { describe, expect, it } from 'vitest';
import { MAX_TEMPLATES, parseTemplates, tplName } from '../src/ui/farmTemplates';

describe('farm templates', () => {
  it('migrates the old { a, b } shape into templates named A and B', () => {
    const list = parseTemplates(JSON.stringify({ a: { light: 5 }, b: { spear: 20, axe: 10 } }))!;
    expect(list.map((t) => t.name)).toEqual(['A', 'B']);
    expect(list[1].units).toEqual({ spear: 20, axe: 10 });
  });

  it('reads the list shape, trims long names and caps the count', () => {
    const saved = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: i === 0 ? 'a very long template name' : '', units: { spear: i } }));
    const list = parseTemplates(JSON.stringify(saved))!;
    expect(list).toHaveLength(MAX_TEMPLATES);
    expect(list[0].name.length).toBeLessThanOrEqual(16);
    expect(tplName(list[2], 2)).toBe('C');
  });

  it('gives up on nothing or junk', () => {
    expect(parseTemplates(null)).toBeNull();
    expect(parseTemplates('not json')).toBeNull();
    expect(parseTemplates('[]')).toBeNull();
  });
});
