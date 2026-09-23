import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { ARMY_ORDER, UNITS } from '../../engine/data/units';
import type { Res, ResKey, UnitId, Units } from '../../engine/types';
import { Icon } from '../art/icons';
import { coords, fmt, fmtClock, fmtDur, fmtShort } from '../format';
import { go, now, warp } from '../store';

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

export function UnitBadge({ u, n, dim }: { u: UnitId; n?: number; dim?: boolean }) {
  return (
    <span class={`unit-badge ${dim ? 'is-dim' : ''}`} title={UNITS[u].name}>
      <Icon name={u} size={16} />
      {n !== undefined && <span class="num">{fmt(n)}</span>}
    </span>
  );
}

export function UnitList({ units, empty = 'none' }: { units: Units | undefined; empty?: string }) {
  const list = ARMY_ORDER.filter((u) => (units?.[u] ?? 0) > 0);
  if (!units || list.length === 0) return <span class="muted">{empty}</span>;
  return (
    <span class="unit-list">
      {list.map((u) => <UnitBadge u={u} n={units[u]!} />)}
    </span>
  );
}

/** Grid table of units with optional loss row (battle reports). */
export function UnitTable({ rows, show }: { rows: { label: string; units?: Units; tone?: string }[]; show?: UnitId[] }) {
  const cols = show ?? ARMY_ORDER.filter((u) => rows.some((r) => (r.units?.[u] ?? 0) > 0));
  if (cols.length === 0) return <p class="muted">No troops.</p>;
  return (
    <div class="table-scroll">
      <table class="unit-table">
        <thead>
          <tr>
            <th />
            {cols.map((u) => (
              <th title={UNITS[u].name}>
                <Icon name={u} size={18} />
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

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: ComponentChildren; badge?: number }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div class="tabs" role="tablist">
      {tabs.map((t) => (
        <button type="button" role="tab" aria-selected={t.id === active} class={`tab ${t.id === active ? 'is-active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.badge ? <span class="badge">{t.badge}</span> : null}
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
  return (
    <button type="button" class="link" onClick={() => go({ name: 'map', focus: vid })} title="Show on the map">
      {name} <span class="coords">({coords(x, y)})</span>
    </button>
  );
}

export function PlayerLink({ id, name }: { id: number | null; name: string }) {
  if (id === null) return <span class="muted">{name}</span>;
  return (
    <button type="button" class="link" onClick={() => go({ name: 'ranking', player: id })}>
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
