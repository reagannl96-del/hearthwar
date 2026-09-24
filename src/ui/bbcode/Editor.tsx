// The forum's writing box: a textarea with a BBCode toolbar above it (bold,
// colours, quotes, spoilers, coordinates…) and a preview of the finished post.
// Buttons wrap whatever is selected in the tags, or drop them in at the cursor.

import type { ComponentChildren, JSX, Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { coords, parseCoords } from '../format';
import { view } from '../store';
import { BBCode } from './render';

type Drawer = 'color' | 'size' | 'coord' | 'player' | 'help' | null;

const PALETTE: { name: string; hex: string }[] = [
  { name: 'red', hex: '#b8392b' }, { name: 'darkred', hex: '#7a2016' }, { name: 'orange', hex: '#d9761e' }, { name: 'gold', hex: '#b88a12' },
  { name: 'green', hex: '#3f7a1f' }, { name: 'teal', hex: '#1f7a72' }, { name: 'blue', hex: '#2c56b0' }, { name: 'navy', hex: '#1c2f6b' },
  { name: 'purple', hex: '#6b3a9c' }, { name: 'brown', hex: '#7a4a1e' }, { name: 'gray', hex: '#6b6259' }, { name: 'black', hex: '#1a120a' },
];

const SIZES: { label: string; arg: string; style: string }[] = [
  { label: 'Small', arg: 'small', style: '0.82em' },
  { label: 'Large', arg: 'large', style: '1.3em' },
  { label: 'Huge', arg: '20', style: '20px' },
];

/** What the tags do, for the help drawer. */
const HELP: [string, string][] = [
  ['[b]bold[/b]  [i]italic[/i]  [u]underline[/u]  [s]strike[/s]', 'Text styles'],
  ['[color=red]…[/color]  [size=large]…[/size]', 'Colour (a name or #hex) and size (small, large or 7–20)'],
  ['[quote=Name]…[/quote]', 'A quote, with who said it'],
  ['[spoiler=Title]…[/spoiler]', 'Hidden until clicked'],
  ['[code]…[/code]', 'Text shown exactly as typed'],
  ['[url=https://…]text[/url]', 'A link (http or https)'],
  ['[list][*]one[*]two[/list]', 'A bulleted list'],
  ['[coord]500|500[/coord]  or just 500|500', 'A spot on the map'],
  ['[player]Name[/player]  [tribe]TAG[/tribe]', 'A ruler or a tribe'],
  ['[hr]  [center]…[/center]', 'A dividing line, centred text'],
];

export interface BBEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  label: string;
  id?: string;
  /** rulers to offer in the [player] drawer (tribe mates) */
  names?: string[];
  inputRef?: Ref<HTMLTextAreaElement>;
}

export function BBEditor({ value, onChange, placeholder, rows = 5, maxLength = 5000, label, id, names = [], inputRef }: BBEditorProps) {
  const ta = useRef<HTMLTextAreaElement | null>(null);
  const [preview, setPreview] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const setRef = (el: HTMLTextAreaElement | null) => {
    ta.current = el;
    if (typeof inputRef === 'function') inputRef(el);
    else if (inputRef) (inputRef as { current: HTMLTextAreaElement | null }).current = el;
  };

  /**
   * Put `text` in place of value[start..end] and select [selStart, selEnd) of what went in.
   * Going through insertText keeps the browser's undo (Ctrl+Z) working.
   */
  const replace = (start: number, end: number, text: string, selStart: number, selEnd: number) => {
    const el = ta.current;
    if (!el) return;
    const before = el.value;
    el.focus();
    el.setSelectionRange(start, end);
    let done = false;
    try { done = document.execCommand('insertText', false, text) && el.value !== before; } catch { done = false; }
    if (!done) {
      const next = before.slice(0, start) + text + before.slice(end);
      el.value = next;
      onChange(next);
    }
    el.setSelectionRange(start + selStart, start + selEnd);
  };

  /** wrap the selection in open/close (or unwrap it, if it is wrapped in exactly those already) */
  const wrap = (open: string, close: string, fill = '') => {
    const el = ta.current;
    if (!el) return;
    setDrawer(null);
    const v = el.value, s = el.selectionStart, e = el.selectionEnd;
    const sel = v.slice(s, e);
    if (sel && v.slice(s - open.length, s) === open && v.slice(e, e + close.length) === close) {
      replace(s - open.length, e + close.length, sel, 0, sel.length);
      return;
    }
    // a double-click also picks up the space after a word: that stays outside the tags
    const lead = sel.trim() ? /^\s*/.exec(sel)![0] : '';
    const trail = sel.trim() ? /\s*$/.exec(sel)![0] : '';
    const inner = sel.trim() ? sel.slice(lead.length, sel.length - trail.length) : sel || fill;
    replace(s, e, lead + open + inner + close + trail, lead.length + open.length, lead.length + open.length + inner.length);
  };

  const insert = (text: string, caret = text.length) => {
    const el = ta.current;
    if (!el) return;
    setDrawer(null);
    // goes in after whatever is selected, never over it
    replace(el.selectionEnd, el.selectionEnd, text, caret, caret);
  };

  const link = () => {
    const el = ta.current;
    if (!el) return;
    const sel = el.value.slice(el.selectionStart, el.selectionEnd).trim();
    if (/^(https?:\/\/|www\.)\S+$/i.test(sel)) { wrap('[url]', '[/url]'); return; }
    // [url=https://]text[/url], with "https://" selected so a paste lands in the right place
    const s = el.selectionStart, e = el.selectionEnd;
    const text = `[url=https://]${el.value.slice(s, e) || 'link text'}[/url]`;
    setDrawer(null);
    replace(s, e, text, 5, 13);
  };

  const list = () => {
    const el = ta.current;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const lines = el.value.slice(s, e).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    setDrawer(null);
    if (lines.length) {
      const text = `[list]\n${lines.map((l) => `[*]${l}`).join('\n')}\n[/list]`;
      replace(s, e, text, text.length, text.length);
    } else {
      replace(s, e, '[list]\n[*]\n[/list]', 10, 10);
    }
  };

  const coord = () => {
    const el = ta.current;
    if (!el) return;
    const sel = el.value.slice(el.selectionStart, el.selectionEnd);
    const xy = sel ? parseCoords(sel) : null;
    if (xy) { replace(el.selectionStart, el.selectionEnd, `[coord]${coords(xy[0], xy[1])}[/coord]`, 7, 7 + coords(xy[0], xy[1]).length); setDrawer(null); return; }
    setDrawer(drawer === 'coord' ? null : 'coord');
  };

  const player = () => {
    const el = ta.current;
    if (!el) return;
    if (el.selectionEnd > el.selectionStart) { wrap('[player]', '[/player]'); return; }
    setDrawer(drawer === 'player' ? null : 'player');
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && drawer) { setDrawer(null); e.preventDefault(); return; }
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'enter') {
      // Ctrl+Enter sends the post
      const form = ta.current?.form;
      if (form) { e.preventDefault(); form.requestSubmit?.(); }
      return;
    }
    if (e.shiftKey) return;
    const tag = k === 'b' ? 'b' : k === 'i' ? 'i' : k === 'u' ? 'u' : null;
    if (!tag) return;
    e.preventDefault();
    wrap(`[${tag}]`, `[/${tag}]`);
  };

  // leaving preview puts the cursor back in the box
  const wasPreview = useRef(preview);
  useEffect(() => {
    if (wasPreview.current && !preview) ta.current?.focus();
    wasPreview.current = preview;
  }, [preview]);

  const toggle = (d: Drawer) => setDrawer(drawer === d ? null : d);
  const mine = view.value?.villages ?? [];
  const near = value.length > maxLength * 0.9;

  return (
    <div class={`bb-editor ${preview ? 'is-preview' : ''}`}>
      <div class="bb-bar">
        <div class="bb-tools" role="toolbar" aria-label="Formatting" aria-controls={id}>
          <Tool label="Bold (Ctrl+B)" onClick={() => wrap('[b]', '[/b]')} disabled={preview}><b>B</b></Tool>
          <Tool label="Italic (Ctrl+I)" onClick={() => wrap('[i]', '[/i]')} disabled={preview}><i class="bb-t-i">I</i></Tool>
          <Tool label="Underline (Ctrl+U)" onClick={() => wrap('[u]', '[/u]')} disabled={preview}><u>U</u></Tool>
          <Tool label="Strike through" onClick={() => wrap('[s]', '[/s]')} disabled={preview}><s>S</s></Tool>
          <span class="bb-sep" aria-hidden="true" />
          <Tool label="Colour" onClick={() => toggle('color')} on={drawer === 'color'} disabled={preview} expands>
            <span class="bb-t-color">A<i /></span>
          </Tool>
          <Tool label="Text size" onClick={() => toggle('size')} on={drawer === 'size'} disabled={preview} expands><span class="bb-t-size">A<small>A</small></span></Tool>
          <span class="bb-sep" aria-hidden="true" />
          <Tool label="Quote" onClick={() => wrap('[quote]', '[/quote]')} disabled={preview}><Glyph d="M5 17c2.2-1 3.4-2.6 3.4-4.6H5.2V6.8h5.4v5.4c0 3.4-1.8 5.8-4.8 6.8Zm8.4 0c2.2-1 3.4-2.6 3.4-4.6h-3.2V6.8H19v5.4c0 3.4-1.8 5.8-4.8 6.8Z" fill /></Tool>
          <Tool label="Spoiler (hidden until clicked)" onClick={() => wrap('[spoiler]', '[/spoiler]')} disabled={preview}>
            <Glyph d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 20 20 4" />
          </Tool>
          <Tool label="Code (shown exactly as typed)" onClick={() => wrap('[code]', '[/code]')} disabled={preview}><Glyph d="m8.5 7-5 5 5 5m7-10 5 5-5 5M13.5 5l-3 14" /></Tool>
          <span class="bb-sep" aria-hidden="true" />
          <Tool label="Link" onClick={link} disabled={preview}><Glyph d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3.2-3.2a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2m1.6 5.3a3.6 3.6 0 0 0-5.1 0l-3.2 3.2a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2" /></Tool>
          <Tool label="List" onClick={list} disabled={preview}><Glyph d="M9 6.5h11M9 12h11M9 17.5h11M4.6 6.5h.1M4.6 12h.1M4.6 17.5h.1" wide /></Tool>
          <Tool label="Centre" onClick={() => wrap('[center]', '[/center]')} disabled={preview}><Glyph d="M4 6h16M7 10h10M4 14h16M7 18h10" /></Tool>
          <Tool label="Dividing line" onClick={() => insert('\n[hr]\n')} disabled={preview}><Glyph d="M3 12h18M7 7.5h10M7 16.5h10" thin /></Tool>
          <span class="bb-sep" aria-hidden="true" />
          <Tool label="Coordinates (a spot on the map)" onClick={coord} on={drawer === 'coord'} disabled={preview} expands>
            <Glyph d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Zm0-8.6a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z" />
          </Tool>
          <Tool label="Ruler (link to a profile)" onClick={player} on={drawer === 'player'} disabled={preview} expands>
            <Glyph d="M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 9c.6-4 3.6-6.5 7.5-6.5s6.9 2.5 7.5 6.5" />
          </Tool>
          <Tool label="Formatting help" onClick={() => toggle('help')} on={drawer === 'help'} expands><span class="bb-t-help">?</span></Tool>
        </div>
        <div class="bb-mode seg" role="group" aria-label="Write or preview">
          <button type="button" class={preview ? '' : 'is-on'} aria-pressed={!preview} onClick={() => { setPreview(false); }}>Write</button>
          <button type="button" class={preview ? 'is-on' : ''} aria-pressed={preview} onClick={() => { setDrawer(null); setPreview(true); }}>Preview</button>
        </div>
      </div>

      {drawer && !preview && (
        <div class="bb-drawer">
          {drawer === 'color' && (
            <div class="bb-swatches" role="group" aria-label="Colours">
              {PALETTE.map((c) => (
                <button type="button" class="bb-swatch" style={{ background: c.hex }} title={c.name} aria-label={c.name} onClick={() => wrap(`[color=${c.hex}]`, '[/color]')} />
              ))}
            </div>
          )}
          {drawer === 'size' && (
            <div class="row gap-sm wrap">
              {SIZES.map((z) => (
                <button type="button" class="chip" onClick={() => wrap(`[size=${z.arg}]`, '[/size]')}><span style={{ fontSize: z.style }}>{z.label}</span></button>
              ))}
            </div>
          )}
          {drawer === 'coord' && (
            <div class="bb-picks">
              <span class="muted small">Your villages:</span>
              {mine.slice(0, 40).map((v) => (
                <button type="button" class="chip" onClick={() => insert(`[coord]${coords(v.x, v.y)}[/coord]`)}>{v.name} <span class="coords">{coords(v.x, v.y)}</span></button>
              ))}
              <button type="button" class="chip is-plain" onClick={() => wrap('[coord]', '[/coord]', '500|500')}>Other…</button>
              <span class="muted small bb-picks-note">Tip: typing coordinates like 512|498 links them to the map by itself.</span>
            </div>
          )}
          {drawer === 'player' && (
            <div class="bb-picks">
              {names.length > 0 && <span class="muted small">Tribe mates:</span>}
              {names.slice(0, 40).map((n) => (
                <button type="button" class="chip" onClick={() => insert(`[player]${n}[/player]`)}>{n}</button>
              ))}
              <button type="button" class="chip is-plain" onClick={() => wrap('[player]', '[/player]', 'Name')}>Someone else…</button>
            </div>
          )}
          {drawer === 'help' && (
            <dl class="bb-help">
              {HELP.map(([code, what]) => <><dt><code>{code}</code></dt><dd>{what}</dd></>)}
              <dt><code>Ctrl+B / I / U · Ctrl+Enter</code></dt><dd>Bold, italic, underline · send</dd>
            </dl>
          )}
        </div>
      )}

      {preview ? (
        <div class="bb-preview" style={{ minHeight: `${rows * 1.5 + 1}em` }} aria-live="polite">
          {value.trim() ? <BBCode text={value} /> : <p class="muted">Nothing to preview yet.</p>}
        </div>
      ) : (
        <textarea
          id={id}
          ref={setRef}
          rows={rows}
          maxLength={maxLength}
          value={value}
          placeholder={placeholder}
          aria-label={label}
          onInput={(e) => onChange(e.currentTarget.value)}
          onKeyDown={onKeyDown as unknown as JSX.KeyboardEventHandler<HTMLTextAreaElement>}
        />
      )}
      <div class={`bb-count ${near ? 'is-near' : ''}`} aria-live={near ? 'polite' : 'off'}>{value.length} / {maxLength}</div>
    </div>
  );
}

function Tool({ label, onClick, children, on, disabled, expands }: { label: string; onClick: () => void; children: ComponentChildren; on?: boolean; disabled?: boolean; expands?: boolean }) {
  return (
    <button
      type="button"
      class={`bb-tool ${on ? 'is-on' : ''}`}
      title={label}
      aria-label={label}
      aria-expanded={expands ? !!on : undefined}
      disabled={disabled}
      // keep the textarea's selection: the button must not take focus on press
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Glyph({ d, fill, wide, thin }: { d: string; fill?: boolean; wide?: boolean; thin?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d={d} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} stroke-width={wide ? 2.6 : thin ? 1.6 : 2} stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

/** Put a quote of someone's post at the end of a reply, and the cursor after it. */
export function appendQuote(current: string, author: string, text: string): string {
  const name = author.replace(/[[\]]/g, '').slice(0, 40);
  const q = `[quote=${name}]${text.trim()}[/quote]\n`;
  const lead = current && !current.endsWith('\n') ? `${current}\n` : current;
  return lead + q;
}
