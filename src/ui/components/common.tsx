import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ARMY_ORDER, UNITS } from '../../engine/data/units';
import type { Res, ResKey, UnitId, Units } from '../../engine/types';
import { themeOfHero, themedUnitName, type VillageTheme } from '../../engine/data/themes';
import { REGION_NAMES, type Region } from '../../engine/regions';
import { ICON_NAMES, Icon, themedUnitIcon } from '../art/icons';
import { coords, fmt, fmtClock, fmtDur, fmtShort } from '../format';
import { copyText } from '../clipboard';
import { now, toast, village, warp, usePane } from '../store';

const HAS_ICON = new Set(ICON_NAMES);

export const RES_LABEL: Record<ResKey, string> = { wood: 'Wood', clay: 'Clay', iron: 'Iron' };

export function Res({ k, n, short, lacking }: { k: ResKey; n: number; short?: boolean; lacking?: boolean }) {
  return (
    <span class={`res res-${k} ${lacking ? 'is-lacking' : ''}`} title={RES_LABEL[k]}>
      <Icon name={k} size={16} />
      <span class="num">{short ? fmtShort(n) : fmt(n)}</span>
    </span>
  );
}

export function Cost({ cost, have, pop, time, compact }: { cost: Res; have?: Res; pop?: number; time?: number; compact?: boolean }) {
  return (
    <span class={`cost ${compact ? 'is-compact' : ''}`}>
      {(['wood', 'clay', 'iron'] as ResKey[]).map((k) => (
        <Res k={k} n={cost[k]} short={compact} lacking={have ? have[k] < cost[k] : false} />
      ))}
      {pop !== undefined && pop > 0 && (
        <span class="res res-pop" title="Population">
          <Icon name="pop" size={16} />
          <span class="num">{fmt(pop)}</span>
        </span>
      )}
      {time !== undefined && (
        <span class="res res-time" title="Duration">
          <Icon name="time" size={15} />
          <span class="num">{fmtDur(time)}</span>
        </span>
      )}
    </span>
  );
}

export function Countdown({ until, done = 'done' }: { until: number; done?: string }) {
  const left = until - now.value;
  return <span class="num countdown">{left <= 0 ? done : fmtDur(left / warp.value)}</span>;
}

export function Clock({ t }: { t: number }) {
  return <span class="num clock">{fmtClock(t, now.value, warp.value)}</span>;
}

export function Progress({ from, to, tone }: { from: number; to: number; tone?: 'accent' | 'danger' | 'ok' }) {
  const p = Math.max(0, Math.min(1, (now.value - from) / Math.max(1, to - from)));
  return (
    <div class={`progress ${tone ? `tone-${tone}` : ''}`} role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${p * 100}%` }} />
    </div>
  );
}

export function Bar({ value, max, tone }: { value: number; max: number; tone?: 'accent' | 'danger' | 'ok' | 'warn' }) {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div class={`progress ${tone ? `tone-${tone}` : ''}`}>
      <div style={{ width: `${p * 100}%` }} />
    </div>
  );
}

/** The look of the village being viewed: its army takes the form of its statue hero's people. */
export const viewTheme = (): VillageTheme => themeOfHero(village.value?.hero);

/** A troop's name as a village of this theme (by default, the one in view) calls it. */
export function unitName(u: UnitId, plural = false, theme: VillageTheme = viewTheme()): string {
  return themedUnitName(u, theme, plural, [UNITS[u].name, UNITS[u].plural]);
}

export function UnitIcon({ u, size = 18, theme = viewTheme(), title }: { u: UnitId; size?: number; theme?: VillageTheme; title?: string }) {
  // a look whose troops have no art of their own yet falls back on the classic troop
  const name = themedUnitIcon(u, theme);
  return <Icon name={HAS_ICON.has(name) ? name : u} size={size} title={title} />;
}

export function UnitBadge({ u, n, dim, theme = viewTheme() }: { u: UnitId; n?: number; dim?: boolean; theme?: VillageTheme }) {
  return (
    <span class={`unit-badge ${dim ? 'is-dim' : ''}`} title={unitName(u, false, theme)}>
      <UnitIcon u={u} size={16} theme={theme} />
      {n !== undefined && <span class="num">{fmt(n)}</span>}
    </span>
  );
}

/** Every kind of troop a village can own, for lists of what it has (horse merchants last: they trade, not fight). */
export const OWNED_ORDER: UnitId[] = [...ARMY_ORDER, 'trader'];

export function UnitList({ units, empty = 'none', theme }: { units: Units | undefined; empty?: string; theme?: VillageTheme }) {
  const list = OWNED_ORDER.filter((u) => (units?.[u] ?? 0) > 0);
  if (!units || list.length === 0) return <span class="muted">{empty}</span>;
  return (
    <span class="unit-list">
      {list.map((u) => <UnitBadge u={u} n={units[u]!} theme={theme} />)}
    </span>
  );
}

/** Grid table of units with optional loss row (battle reports). */
export function UnitTable({ rows, show, theme }: { rows: { label: string; units?: Units; tone?: string }[]; show?: UnitId[]; theme?: VillageTheme }) {
  const cols = show ?? OWNED_ORDER.filter((u) => rows.some((r) => (r.units?.[u] ?? 0) > 0));
  if (cols.length === 0) return <p class="muted">No troops.</p>;
  return (
    <div class="table-scroll">
      <table class="unit-table">
        <thead>
          <tr>
            <th />
            {cols.map((u) => (
              <th title={unitName(u, false, theme)}>
                <UnitIcon u={u} size={18} theme={theme} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr class={r.tone}>
              <th scope="row">{r.label}</th>
              {cols.map((u) => {
                const n = r.units === undefined ? undefined : r.units[u] ?? 0;
                return <td class={`num ${n === 0 ? 'zero' : ''}`}>{n === undefined ? '?' : fmt(n)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Btn(p: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet'; small?: boolean }) {
  const { variant = 'primary', small, class: cls, ...rest } = p;
  return <button type="button" class={`btn btn-${variant} ${small ? 'btn-sm' : ''} ${cls ?? ''}`} {...rest} />;
}

/** A little glowing speech bubble: something new to read (the tribe forum). */
export function NewPosts({ n, title = 'New posts', size = 16 }: { n?: number; title?: string; size?: number }) {
  return (
    <span class="new-posts" title={title} aria-label={n ? `${n} ${title.toLowerCase()}` : title}>
      <svg viewBox="0 0 20 18" width={size} height={Math.round(size * 0.9)} aria-hidden="true">
        <path d="M3 1.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3.5V13.5H3a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" fill="currentColor" stroke="rgba(10,30,70,0.55)" stroke-width="1.2" />
        <circle cx="6" cy="7.5" r="1.3" fill="#1d4a9a" /><circle cx="10" cy="7.5" r="1.3" fill="#1d4a9a" /><circle cx="14" cy="7.5" r="1.3" fill="#1d4a9a" />
      </svg>
      {n ? <span class="num">{n}</span> : null}
    </span>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: ComponentChildren; badge?: number; unread?: number }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div class="tabs" role="tablist">
      {tabs.map((t) => (
        <button type="button" role="tab" aria-selected={t.id === active} class={`tab ${t.id === active ? 'is-active' : ''} ${t.unread ? 'has-unread' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.badge ? <span class="badge">{t.badge}</span> : null}
          {t.unread ? <NewPosts n={t.unread} title="Unread threads" /> : null}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: ComponentChildren; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class={`modal ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" tabIndex={-1} ref={ref}>
        <header class="modal-head">
          <h2>{title}</h2>
          <button type="button" class="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div class="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function NumInput({ value, onInput, max, id, placeholder }: { value: number | ''; onInput: (n: number | '') => void; max?: number; id?: string; placeholder?: string }) {
  return (
    <span class="num-input">
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        placeholder={placeholder ?? '0'}
        onInput={(e) => {
          const v = (e.currentTarget as HTMLInputElement).value;
          onInput(v === '' ? '' : Math.max(0, Math.floor(Number(v))));
        }}
      />
      {max !== undefined && (
        <button type="button" class="max-link" onClick={() => onInput(max)} title="Use the maximum">
          ({fmt(max)})
        </button>
      )}
    </span>
  );
}

export function VillageLink({ vid, name, x, y }: { vid: number; name: string; x: number; y: number }) {
  const pane = usePane();
  return (
    <span class="vlink">
      <button type="button" class="link" onClick={() => pane.go({ name: 'map', focus: vid })} title="Show on the map">
        {name} <span class="coords">({coords(x, y)})</span>
      </button>
      <CopyButton text={coords(x, y)} label={`Copy coordinates ${coords(x, y)}`} class="is-reveal" />
    </span>
  );
}

/**
 * A small copy-to-clipboard button: a tick and a "Copied!" bubble for a moment
 * after, or a toast if the browser refused. The visible button stays small, but its
 * tap area is a thumb wide.
 */
export function CopyButton({ text, label = 'Copy', children, class: cls, done = 'Copied!', icon = 'copy' }: { text: string; label?: string; children?: ComponentChildren; class?: string; done?: string; icon?: 'copy' | 'link' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const onClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyText(text);
    clearTimeout(timer.current);
    if (!ok) { setCopied(false); toast(`Could not reach the clipboard. Copy it by hand: ${text}`, 'warn'); return; }
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button type="button" class={`copy-btn ${children ? 'has-text' : ''} ${copied ? 'is-done' : ''} ${cls ?? ''}`} onClick={onClick} title={label} aria-label={children ? undefined : label}>
      <Icon name={copied ? 'check' : icon} size={14} />
      {children}
      <span class="copy-tip" role="status" aria-live="polite">{copied ? done : ''}</span>
    </button>
  );
}

export function PlayerLink({ id, name }: { id: number | null; name: string }) {
  const pane = usePane();
  if (id === null) return <span class="muted">{name}</span>;
  return (
    <button type="button" class="link" onClick={() => pane.go({ name: 'ranking', player: id })}>
      {name}
    </button>
  );
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <p class="empty">{children}</p>;
}

export function Section({ title, children, actions, class: cls }: { title?: ComponentChildren; children: ComponentChildren; actions?: ComponentChildren; class?: string }) {
  return (
    <section class={`panel ${cls ?? ''}`}>
      {(title || actions) && (
        <header class="panel-head">
          {title && <h3>{title}</h3>}
          {actions && <div class="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** A land's name as a title: "the frozen north" → "Frozen north". */
export function regionTitle(r: Region): string {
  const s = REGION_NAMES[r].replace(/^the /, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A small badge for one of the realm's lands: a dot in the land's colour, then its name (or what is passed). */
export function RegionChip({ r, children, class: cls, title }: { r: Region; children?: ComponentChildren; class?: string; title?: string }) {
  return (
    <span class={`region-chip region-${r} ${cls ?? ''}`} title={title}>
      <i aria-hidden="true" />
      {children ?? regionTitle(r)}
    </span>
  );
}
