// A ruler's banner: flown either side of the gate of every village whose wall has
// reached level 20. It is put together from a few fixed lists (shape, pattern,
// emblem and three colours), well over a thousand designs in all.

export interface FlagDesign {
  shape: number;
  pattern: number;
  charge: number;
  /** the field (background), the pattern's colour, and the emblem's colour: indexes into FLAG_COLORS */
  field: number;
  accent: number;
  chargeColor: number;
}

export const FLAG_SHAPES = ['Banner', 'Swallowtail', 'Pennant', 'Gonfalon', 'Square', 'Long pennon', 'Tattered', 'Split banner'] as const;
export const FLAG_PATTERNS = ['Plain', 'Stripe', 'Two stripes', 'Cross', 'Saltire', 'Chevron', 'Quartered', 'Border', 'Per pale', 'Per fess', 'Bend', 'Chequy'] as const;
export const FLAG_CHARGES = ['None', 'Star', 'Sun', 'Moon', 'Crown', 'Sword', 'Tower', 'Wolf', 'Tree', 'Skull', 'Flame', 'Shield', 'Leaf', 'Rune', 'Anchor', 'Eagle'] as const;
export const FLAG_COLORS = [
  { name: 'Crimson', hex: '#b3261a' }, { name: 'Royal blue', hex: '#2c56b0' }, { name: 'Forest', hex: '#2f6a2c' },
  { name: 'Gold', hex: '#e0a526' }, { name: 'Ivory', hex: '#f3eee2' }, { name: 'Sable', hex: '#1e1a1c' },
  { name: 'Purple', hex: '#5b36b0' }, { name: 'Orange', hex: '#d86a1c' }, { name: 'Sky', hex: '#5aa8d8' },
  { name: 'Wine', hex: '#6e1a2e' }, { name: 'Silver', hex: '#b8bec6' }, { name: 'Teal', hex: '#1f7a74' },
  { name: 'Rose', hex: '#d8708a' }, { name: 'Bronze', hex: '#8a5a2a' },
] as const;

/** How many different banners can be made. */
export const FLAG_OPTIONS = FLAG_SHAPES.length * FLAG_PATTERNS.length * FLAG_CHARGES.length * FLAG_COLORS.length ** 3;

/** A ruler who never made one flies this: a red banner with a gold stripe and star. */
export const DEFAULT_FLAG: FlagDesign = { shape: 0, pattern: 1, charge: 1, field: 0, accent: 3, chargeColor: 3 };

const idx = (n: unknown, len: number, dflt: number) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= 0 && v < len ? v : dflt;
};

/** Whatever the client sent, as a design that exists. */
export function sanitizeFlag(raw: unknown): FlagDesign {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    shape: idx(r.shape, FLAG_SHAPES.length, DEFAULT_FLAG.shape),
    pattern: idx(r.pattern, FLAG_PATTERNS.length, DEFAULT_FLAG.pattern),
    charge: idx(r.charge, FLAG_CHARGES.length, DEFAULT_FLAG.charge),
    field: idx(r.field, FLAG_COLORS.length, DEFAULT_FLAG.field),
    accent: idx(r.accent, FLAG_COLORS.length, DEFAULT_FLAG.accent),
    chargeColor: idx(r.chargeColor, FLAG_COLORS.length, DEFAULT_FLAG.chargeColor),
  };
}

/** Colours that read well together: a light and a dark never clash (index into FLAG_COLORS). */
const LIGHT = new Set([3, 4, 8, 10, 12]);

/**
 * A banner of their own for a ruler who never designed one (the AI rulers): always the
 * same for the same seed, with a field and pattern colour that contrast, and an emblem
 * that stands out on the field.
 */
export function flagFor(seed: number): FlagDesign {
  let x = (seed * 2654435761) >>> 0;
  const next = (n: number) => {
    x = (Math.imul(x ^ (x >>> 15), 2246822519) + 0x9e3779b9) >>> 0;
    return x % n;
  };
  const shape = next(FLAG_SHAPES.length);
  const pattern = next(FLAG_PATTERNS.length);
  const charge = 1 + next(FLAG_CHARGES.length - 1);
  const field = next(FLAG_COLORS.length);
  const pickContrast = (against: number) => {
    const want = !LIGHT.has(against);
    const pool = FLAG_COLORS.map((_, i) => i).filter((i) => i !== against && LIGHT.has(i) === want);
    return pool[next(pool.length)];
  };
  const accent = pickContrast(field);
  // the emblem sits on the field (plain or partly patterned): it contrasts with the field
  const chargeColor = pickContrast(field);
  return { shape, pattern, charge, field, accent, chargeColor };
}
