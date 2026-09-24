// BBCode, the way Tribal Wars forums speak it: [b], [quote=Name], [spoiler],
// [coord]500|500[/coord] and friends. This turns a post's plain text into a small
// tree that the renderer draws with real elements. Nothing here ever becomes HTML:
// every attribute is checked against a short list of what is allowed, and anything
// that does not add up (an unknown tag, a tag never closed, a link to somewhere
// other than http/https) simply stays in the post as the text that was typed.

export type BBNode =
  | { t: 'text'; v: string }
  | { t: 'tag'; tag: ContainerTag; arg?: string; children: BBNode[] }
  | { t: 'list'; ordered: boolean; items: BBNode[][] }
  | { t: 'link'; href: string; children: BBNode[]; auto?: boolean }
  | { t: 'code'; v: string }
  | { t: 'hr' }
  | { t: 'coord'; x: number; y: number; village?: boolean }
  | { t: 'player'; name: string }
  | { t: 'tribe'; tag: string }
  | { t: 'thread'; id: number; post?: number; label?: string };

export type ContainerTag = 'b' | 'i' | 'u' | 's' | 'center' | 'color' | 'size' | 'quote' | 'spoiler';

/** posts are 5000 characters; anything far beyond that is not a post */
export const BB_MAX_INPUT = 20_000;
const MAX_DEPTH = 16;
const MAX_TAGS = 1500;

const INLINE = new Set(['b', 'i', 'u', 's', 'color', 'size']);
const BLOCK = new Set(['center', 'quote', 'spoiler']);
/** tags whose inside is taken as it stands, never read for more tags */
const RAW = new Set(['code', 'coord', 'village', 'player', 'tribe', 'ally', 'thread']);

export const BB_COLORS: Record<string, string> = {
  red: '#b8392b', darkred: '#7a2016', orange: '#d9761e', gold: '#b88a12', yellow: '#c9a300', green: '#3f7a1f',
  darkgreen: '#2f4d1a', teal: '#1f7a72', blue: '#2c56b0', navy: '#1c2f6b', purple: '#6b3a9c', brown: '#7a4a1e',
  gray: '#6b6259', grey: '#6b6259', black: '#1a120a', white: '#ffffff',
};

/** A colour a post may use: #rgb, #rrggbb, or one of a few names. */
export function safeColor(raw: string | undefined): string | null {
  if (!raw) return null;
  const c = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(c) || /^#[0-9a-f]{6}$/.test(c)) return c;
  return BB_COLORS[c] ?? null;
}

/** [size=small], [size=large], or a pixel size from 7 to 20 as in Tribal Wars. */
export function safeSize(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (s === 'small') return '0.82em';
  if (s === 'large' || s === 'big') return '1.3em';
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    if (n >= 7 && n <= 20) return `${n}px`;
  }
  return null;
}

/** Only real web links: http and https, nothing that runs or opens anything else. */
export function safeUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (s.length > 1000 || /[\s<>"'`\\]/.test(s)) return null;
  if (/^www\./i.test(s)) s = `https://${s}`;
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** A forum thread link as the game writes it: …#t/123 or …#t/123/456 (a post in it). */
export function parseThreadHash(hash: string): { thread: number; post?: number } | null {
  const m = /^#?t\/(\d{1,12})(?:\/(\d{1,12}))?\/?$/.exec(hash.trim());
  if (!m) return null;
  return { thread: Number(m[1]), ...(m[2] ? { post: Number(m[2]) } : {}) };
}

const COORD_RE = /^\s*(\d{1,3})\s*\|\s*(\d{1,3})\s*$/;
const unquote = (s: string) => s.trim().replace(/^(["'])(.*)\1$/, '$2').trim();

// the tag reader: [b], [/b], [color=#f00], [quote="Name"], [*]
const TAG_RE = /\[(\/?)(\*|[a-z]{1,8})(?:=([^\]\n]{0,300}))?\]/gi;

interface Frame { tag: string; arg?: string; raw: string; children: BBNode[]; items?: BBNode[][] }

export function parseBBCode(input: string): BBNode[] {
  const src = String(input ?? '').slice(0, BB_MAX_INPUT);
  const lower = src.toLowerCase();
  const root: Frame = { tag: '', raw: '', children: [] };
  const stack: Frame[] = [root];
  const noClose = new Set<string>(); // raw tags with no closing tag further on: don't look again
  const top = () => stack[stack.length - 1];
  const text = (v: string) => { if (v) top().children.push({ t: 'text', v }); };
  const inLink = () => stack.some((f) => f.tag === 'url');

  /** a frame that never closed: its tag goes back to being text, its contents stay */
  const unwind = (f: Frame, into: Frame) => {
    if (f.tag === '*') { closeItem(f, into); return; }
    into.children.push({ t: 'text', v: f.raw });
    if (f.items) for (const it of f.items) into.children.push({ t: 'text', v: '[*]' }, ...it);
    into.children.push(...f.children);
  };
  const closeItem = (item: Frame, list: Frame) => { (list.items ??= []).push(item.children); };

  let pos = 0, tags = 0;
  TAG_RE.lastIndex = 0;
  for (let m = TAG_RE.exec(src); m; m = TAG_RE.exec(src)) {
    const [raw, slash, nameRaw, argRaw] = m;
    const name = nameRaw.toLowerCase();
    const end = m.index + raw.length;
    if (++tags > MAX_TAGS) break;
    text(src.slice(pos, m.index));
    pos = end;
    const literal = () => text(raw);

    if (slash) {
      if (argRaw !== undefined) { literal(); continue; }
      if (name === '*') {
        // [/*] is optional in Tribal Wars; it just ends the item
        if (top().tag === '*') { const it = stack.pop()!; closeItem(it, top()); } else if (top().tag !== 'list') literal();
        continue;
      }
      let i = stack.length - 1;
      while (i > 0 && stack[i].tag !== name) i--;
      if (i === 0) { literal(); continue; }
      while (stack.length - 1 > i) { const f = stack.pop()!; unwind(f, top()); }
      const f = stack.pop()!;
      const node = finish(f);
      if (node) top().children.push(node);
      else unwind(f, top());
      continue;
    }

    // opening tags
    if (name === 'hr' && argRaw === undefined) { top().children.push({ t: 'hr' }); continue; }
    if (name === '*') {
      if (argRaw !== undefined) { literal(); continue; }
      if (top().tag === '*') { const it = stack.pop()!; closeItem(it, top()); }
      if (top().tag === 'list') stack.push({ tag: '*', raw, children: [] });
      else literal();
      continue;
    }
    if (RAW.has(name) || (name === 'url' && argRaw === undefined)) {
      const close = `[/${name}]`;
      const at = noClose.has(name) ? -1 : lower.indexOf(close, end);
      if (at < 0) { noClose.add(name); literal(); continue; }
      const node = leaf(name, argRaw, src.slice(end, at), inLink());
      if (!node) { literal(); continue; }
      top().children.push(node);
      pos = at + close.length;
      TAG_RE.lastIndex = pos;
      continue;
    }
    const known = INLINE.has(name) || BLOCK.has(name) || name === 'url' || name === 'list';
    if (!known || stack.length > MAX_DEPTH) { literal(); continue; }
    if (name === 'url' && inLink()) { literal(); continue; }
    if (!validArg(name, argRaw)) { literal(); continue; }
    stack.push({ tag: name, arg: argRaw, raw, children: [] });
  }
  text(src.slice(pos));
  while (stack.length > 1) { const f = stack.pop()!; unwind(f, top()); }
  return tidy(linkify(merge(root.children), false));
}

function validArg(name: string, arg: string | undefined): boolean {
  switch (name) {
    case 'color': return safeColor(arg) !== null;
    case 'size': return safeSize(arg) !== null;
    case 'url': return safeUrl(unquote(arg ?? '')) !== null;
    case 'quote': case 'spoiler': return arg === undefined || unquote(arg).length <= 80;
    case 'list': return arg === undefined || arg === '1' || arg === 'a';
    default: return arg === undefined;
  }
}

/** A frame closed properly: make its node (null if it turns out not to be one). */
function finish(f: Frame): BBNode | null {
  const children = merge(f.children);
  switch (f.tag) {
    case 'url': return { t: 'link', href: safeUrl(unquote(f.arg ?? ''))!, children };
    case 'list': {
      const items = (f.items ?? []).map(merge);
      // anything written before the first [*] (other than spacing) still shows, as an item
      const before = children.filter((n) => !(n.t === 'text' && !n.v.trim()));
      if (before.length) items.unshift(before);
      return { t: 'list', ordered: f.arg !== undefined, items };
    }
    case 'quote': case 'spoiler': {
      const arg = f.arg !== undefined ? unquote(f.arg) : undefined;
      return { t: 'tag', tag: f.tag, ...(arg ? { arg } : {}), children };
    }
    case 'color': return { t: 'tag', tag: 'color', arg: safeColor(f.arg)!, children };
    case 'size': return { t: 'tag', tag: 'size', arg: safeSize(f.arg)!, children };
    case 'b': case 'i': case 'u': case 's': case 'center':
      return { t: 'tag', tag: f.tag, children };
    default: return null;
  }
}

/** The tags whose inside is plain: code, coordinates, names, links. */
function leaf(name: string, arg: string | undefined, inner: string, inLink: boolean): BBNode | null {
  switch (name) {
    case 'code': return arg === undefined ? { t: 'code', v: inner.replace(/^\r?\n/, '').replace(/\r?\n$/, '') } : null;
    case 'coord': case 'village': {
      const m = arg === undefined ? COORD_RE.exec(inner) : null;
      return m ? { t: 'coord', x: Number(m[1]), y: Number(m[2]), ...(name === 'village' ? { village: true } : {}) } : null;
    }
    case 'player': {
      const n = inner.trim();
      return arg === undefined && n && n.length <= 40 && !/[\n[\]]/.test(n) ? { t: 'player', name: n } : null;
    }
    case 'tribe': case 'ally': {
      const tag = inner.trim().replace(/^\[(.*)\]$/, '$1');
      return arg === undefined && tag && tag.length <= 32 && !/[\n[\]]/.test(tag) ? { t: 'tribe', tag } : null;
    }
    case 'thread': {
      // [thread]123[/thread], [thread]123/456[/thread] or [thread=123]Our plans[/thread]
      const ref = arg !== undefined ? arg.trim() : inner.trim();
      const m = /^(\d{1,12})(?:\/(\d{1,12}))?$/.exec(ref);
      if (!m) return null;
      const label = arg !== undefined ? inner.trim().slice(0, 120) : '';
      if (/[\n[\]]/.test(label)) return null;
      return { t: 'thread', id: Number(m[1]), ...(m[2] ? { post: Number(m[2]) } : {}), ...(label ? { label } : {}) };
    }
    case 'url': {
      if (inLink) return null;
      const href = safeUrl(inner);
      return href ? { t: 'link', href, children: [{ t: 'text', v: inner.trim() }] } : null;
    }
    default: return null;
  }
}

/** neighbouring bits of text become one */
function merge(nodes: BBNode[]): BBNode[] {
  const out: BBNode[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (n.t === 'text' && last?.t === 'text') out[out.length - 1] = { t: 'text', v: last.v + n.v };
    else if (n.t !== 'text' || n.v) out.push(n);
  }
  return out;
}

// bare coordinates (512|498) and web links in running text become links, as in Tribal Wars
const AUTO_RE = /(https?:\/\/[^\s<>"'[\]]+)|(^|[^\d|])(\d{1,3})\|(\d{1,3})(?![\d|])/gi;

function linkify(nodes: BBNode[], inLink: boolean): BBNode[] {
  const out: BBNode[] = [];
  for (const n of nodes) {
    if (n.t === 'text') {
      if (inLink) { out.push(n); continue; }
      let last = 0;
      AUTO_RE.lastIndex = 0;
      for (let m = AUTO_RE.exec(n.v); m; m = AUTO_RE.exec(n.v)) {
        if (m[1]) {
          // a link does not end in the full stop or bracket after it
          const url = m[1].replace(/[.,;:!?)]+$/, '');
          const href = safeUrl(url);
          if (!href) continue;
          if (m.index > last) out.push({ t: 'text', v: n.v.slice(last, m.index) });
          out.push({ t: 'link', href, children: [{ t: 'text', v: url }], auto: true });
          last = m.index + url.length;
          AUTO_RE.lastIndex = last;
        } else {
          const at = m.index + m[2].length;
          if (at > last) out.push({ t: 'text', v: n.v.slice(last, at) });
          out.push({ t: 'coord', x: Number(m[3]), y: Number(m[4]) });
          last = m.index + m[0].length;
        }
      }
      if (last < n.v.length) out.push(last === 0 ? n : { t: 'text', v: n.v.slice(last) });
    } else if (n.t === 'tag') {
      out.push({ ...n, children: linkify(n.children, inLink) });
    } else if (n.t === 'link') {
      out.push({ ...n, children: linkify(n.children, true) });
    } else if (n.t === 'list') {
      out.push({ ...n, items: n.items.map((it) => linkify(merge(it), inLink)) });
    } else out.push(n);
  }
  return out;
}

const isBlock = (n: BBNode | undefined) =>
  !!n && (n.t === 'code' || n.t === 'hr' || n.t === 'list' || (n.t === 'tag' && BLOCK.has(n.tag)));

/**
 * Line breaks next to a block (a quote, a list, a spoiler) would show as empty
 * lines on top of the block's own spacing: one is dropped on each side.
 */
function tidy(nodes: BBNode[]): BBNode[] {
  const out: BBNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    let n = nodes[i];
    if (n.t === 'text') {
      let v = n.v;
      if (isBlock(nodes[i - 1])) v = v.replace(/^\r?\n/, '');
      if (isBlock(nodes[i + 1])) v = v.replace(/\r?\n$/, '');
      if (!v) continue;
      n = v === n.v ? n : { t: 'text', v };
    } else if (n.t === 'tag') {
      n = { ...n, children: trimEnds(tidy(n.children), BLOCK.has(n.tag)) };
    } else if (n.t === 'link') {
      n = { ...n, children: tidy(n.children) };
    } else if (n.t === 'list') {
      n = { ...n, items: n.items.map((it) => trimEnds(tidy(it), true)) };
    }
    out.push(n);
  }
  return out;
}

function trimEnds(nodes: BBNode[], block: boolean): BBNode[] {
  if (!block || nodes.length === 0) return nodes;
  const out = [...nodes];
  const first = out[0], last = out[out.length - 1];
  if (first.t === 'text') out[0] = { t: 'text', v: first.v.replace(/^\s*\n/, '') };
  if (last.t === 'text') out[out.length - 1] = { t: 'text', v: (out[out.length - 1] as { v: string }).v.replace(/\n\s*$/, '') };
  return out.filter((n) => n.t !== 'text' || n.v);
}

// ---------- plain text ----------

/**
 * A post with its tags taken out, for previews and one-line excerpts: spoilers
 * stay hidden, quotes of other people's words are left out, and the rest reads
 * as it would on the page.
 */
export function stripBBCode(input: string, opts: { quotes?: boolean } = {}): string {
  const out = plain(parseBBCode(input), opts.quotes ?? false);
  return out.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function plain(nodes: BBNode[], quotes: boolean): string {
  let s = '';
  for (const n of nodes) {
    switch (n.t) {
      case 'text': s += n.v; break;
      case 'code': s += n.v; break;
      case 'hr': s += '\n'; break;
      case 'coord': s += `${n.x}|${n.y}`; break;
      case 'player': s += n.name; break;
      case 'tribe': s += `[${n.tag}]`; break;
      case 'thread': s += n.label ?? 'forum thread'; break;
      case 'link': s += plain(n.children, quotes); break;
      case 'list': s += '\n' + n.items.map((it) => `• ${plain(it, quotes).trim()}`).join('\n') + '\n'; break;
      case 'tag':
        if (n.tag === 'spoiler') s += n.arg ? `(spoiler: ${n.arg})` : '(spoiler)';
        else if (n.tag === 'quote') s += quotes ? `\n${plain(n.children, quotes)}\n` : ' ';
        else if (n.tag === 'center') s += `\n${plain(n.children, quotes)}\n`;
        else s += plain(n.children, quotes);
        break;
    }
  }
  return s;
}

/** One line of a post for a list: tags out, whitespace folded, cut with an ellipsis. */
export function excerpt(input: string, max = 90): string {
  const s = stripBBCode(input).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
