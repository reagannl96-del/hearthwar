// The banner editor: put together the ruler's own flag from a shape, a pattern,
// an emblem and three colours. It flies at the gate of every village whose
// wall has reached level 20, in the 3D village for everyone to see.

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_FLAG, FLAG_CHARGES, FLAG_COLORS, FLAG_OPTIONS, FLAG_PATTERNS, FLAG_SHAPES, type FlagDesign,
} from '../../engine/data/flags';
import { Btn, Section } from '../components/common';
import { drawFlag, flagDataUrl, randomFlag } from '../flagArt';
import { fmt } from '../format';
import { act, view, usePane } from '../store';

/** The wall level a village needs before its gate flies the ruler's banner. */
export const BANNER_WALL = 20;

/** A ruler's banner as a small picture (for names in lists and on profiles). */
export function FlagBadge({ flag, w = 30, h = 20, title }: { flag: FlagDesign | null | undefined; w?: number; h?: number; title?: string }) {
  return <img class="flag-badge" src={flagDataUrl(flag, w, h)} width={w} height={h} alt={title ?? ''} title={title} />;
}

/**
 * A ruler's banner hanging from its pole, stirring a little in the wind (still for
 * those who ask for reduced motion). Rulers who never made one fly the default.
 * With `onEdit` it becomes a button into the banner editor.
 */
export function HangingBanner({ flag, label, onEdit }: { flag: FlagDesign | null | undefined; label: string; onEdit?: () => void }) {
  const url = flagDataUrl(flag ?? DEFAULT_FLAG, 150, 100);
  const art = (
    <span class="hb" style={{ '--hb-mask': `url("${url}")` }} aria-hidden="true">
      <span class="hb-pole" />
      <span class="hb-cloth">
        <img src={url} width={150} height={100} alt="" draggable={false} />
        <span class="hb-sheen" />
      </span>
    </span>
  );
  if (!onEdit) return <span class="hb-frame" role="img" aria-label={label}>{art}</span>;
  return (
    <button type="button" class="hb-frame is-editable" onClick={onEdit} aria-label={`${label}: open the banner editor`} title="Change your banner">
      {art}
      <span class="hb-edit">Edit</span>
    </button>
  );
}

const same = (a: FlagDesign, b: FlagDesign) =>
  a.shape === b.shape && a.pattern === b.pattern && a.charge === b.charge && a.field === b.field && a.accent === b.accent && a.chargeColor === b.chargeColor;

/** The big preview: the banner on its pole, drawn sharp for the screen. */
function BannerPreview({ flag }: { flag: FlagDesign }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = 360, h = 240;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    drawFlag(g, flag, w, h);
  }, [flag.shape, flag.pattern, flag.charge, flag.field, flag.accent, flag.chargeColor]);
  return (
    <div class="banner-stage" aria-hidden="true">
      <span class="banner-pole" />
      <canvas ref={ref} class="banner-canvas" />
    </div>
  );
}

type Key = 'shape' | 'pattern' | 'charge';
type ColorKey = 'field' | 'accent' | 'chargeColor';

export function BannerScreen() {
  const pane = usePane();
  const pv = view.value!;
  const saved = pv.me.flag ?? DEFAULT_FLAG;
  const [draft, setDraft] = useState<FlagDesign>(saved);
  const set = (patch: Partial<FlagDesign>) => setDraft({ ...draft, ...patch });
  const dirty = !same(draft, saved);
  const flying = pv.villages.filter((v) => v.buildings.wall >= BANNER_WALL).length;

  const picker = (key: Key, title: string, names: readonly string[]) => (
    <div class="banner-pick">
      <h4>{title} <span class="muted small">· {names[draft[key]]}</span></h4>
      <div class="banner-thumbs" role="radiogroup" aria-label={title}>
        {names.map((n, i) => {
          // patterns are shown without the emblem, emblems on the plain field, so each choice reads clearly
          const d = { ...draft, ...(key === 'pattern' ? { charge: 0 } : key === 'charge' ? { pattern: 0 } : {}), [key]: i } as FlagDesign;
          return (
            <button type="button" role="radio" aria-checked={draft[key] === i} class={`banner-thumb ${draft[key] === i ? 'is-on' : ''}`} title={n} aria-label={n} onClick={() => set({ [key]: i } as Partial<FlagDesign>)}>
              <img src={flagDataUrl(d, 54, 36)} width={54} height={36} alt="" />
            </button>
          );
        })}
      </div>
    </div>
  );

  const colors = (key: ColorKey, title: string) => (
    <div class="banner-pick">
      <h4>{title} <span class="muted small">· {FLAG_COLORS[draft[key]].name}</span></h4>
      <div class="banner-swatches" role="radiogroup" aria-label={title}>
        {FLAG_COLORS.map((c, i) => (
          <button
            type="button" role="radio" aria-checked={draft[key] === i} class={`banner-swatch ${draft[key] === i ? 'is-on' : ''}`}
            style={{ background: c.hex }} title={c.name} aria-label={c.name} onClick={() => set({ [key]: i } as Partial<FlagDesign>)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div class="stack banner-screen">
      <div class="crumbs">
        <button type="button" class="link" onClick={() => pane.go({ name: 'settings' })}>Settings</button>
        <span aria-hidden="true">›</span>
        <span>Your banner</span>
      </div>
      <div class="page-head"><h1>Your banner</h1></div>
      <div class="banner-layout">
        <Section class="banner-preview-panel">
          <BannerPreview flag={draft} />
          <p class="banner-note">
            Flown at the gate of every village whose wall has reached level {BANNER_WALL} — <b class="num">{fmt(FLAG_OPTIONS)}</b> designs to choose from.
          </p>
          <p class="muted small">
            {flying === 0
              ? `None of your villages has a level ${BANNER_WALL} wall yet.`
              : flying === pv.villages.length
                ? (flying === 1 ? 'It flies over your village.' : `It flies over all ${flying} of your villages.`)
                : `It flies over ${flying} of your ${pv.villages.length} villages.`}
          </p>
          <div class="row gap wrap banner-actions">
            <Btn variant="ghost" onClick={() => setDraft(randomFlag())} title="Try a design at random">Random</Btn>
            <Btn variant="quiet" disabled={!dirty} onClick={() => setDraft(saved)}>Undo changes</Btn>
            <span class="grow" />
            <Btn disabled={!dirty} onClick={() => act({ type: 'setFlag', flag: draft }, 'Your new banner is raised.')}>Save banner</Btn>
          </div>
        </Section>
        <Section class="banner-editor">
          {picker('shape', 'Shape', FLAG_SHAPES)}
          {picker('pattern', 'Pattern', FLAG_PATTERNS)}
          {picker('charge', 'Emblem', FLAG_CHARGES)}
          {colors('field', 'Field')}
          {colors('accent', 'Pattern colour')}
          {colors('chargeColor', 'Emblem colour')}
          {dirty && (
            <div class="banner-savebar">
              <FlagBadge flag={draft} w={42} h={28} />
              <span class="small grow">Not saved yet</span>
              <Btn small onClick={() => act({ type: 'setFlag', flag: draft }, 'Your new banner is raised.')}>Save banner</Btn>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
