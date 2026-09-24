// Draws a parsed BBCode post with Preact elements (never as HTML). Coordinates,
// rulers and tribes turn into links into the game when the realm knows them.

import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { coords } from '../format';
import { host, usePane } from '../store';
import type { MapData, MapVillage } from '../../engine/view';
import { parseBBCode, parseThreadHash, type BBNode } from './parse';

// which village stands where, worked out once per version of the map
const byField = new WeakMap<MapData, Map<number, MapVillage>>();
function villageAt(map: MapData, x: number, y: number): MapVillage | undefined {
  let idx = byField.get(map);
  if (!idx) {
    idx = new Map(map.villages.map((v) => [v.y * map.size + v.x, v]));
    byField.set(map, idx);
  }
  return idx.get(y * map.size + x);
}

/** A post (or a tribe description) drawn from its BBCode. */
export function BBCode({ text, class: cls }: { text: string; class?: string }) {
  const nodes = useMemo(() => parseBBCode(text), [text]);
  return <div class={`bb ${cls ?? ''}`}>{renderBB(nodes)}</div>;
}

/** The elements for a parsed post. Exported for tests. */
export function renderBB(nodes: BBNode[], inLink = false): ComponentChildren[] {
  return nodes.map((n, i) => renderNode(n, i, inLink));
}

function renderNode(n: BBNode, key: number, inLink: boolean): ComponentChildren {
  switch (n.t) {
    case 'text': return n.v;
    case 'hr': return <hr key={key} class="bb-hr" />;
    case 'code': return <pre key={key} class="bb-code"><code>{n.v}</code></pre>;
    case 'coord': return inLink ? coords(n.x, n.y) : <BBCoord key={key} x={n.x} y={n.y} />;
    case 'player': return inLink ? n.name : <BBPlayer key={key} name={n.name} />;
    case 'tribe': return inLink ? `[${n.tag}]` : <BBTribe key={key} tag={n.tag} />;
    case 'thread': return inLink ? (n.label ?? 'forum thread') : <BBThread key={key} id={n.id} post={n.post} label={n.label} />;
    case 'link': {
      const thread = inAppThread(n.href);
      if (thread && !inLink) return <BBThread key={key} id={thread.thread} post={thread.post} />;
      return (
        <a key={key} class="bb-url" href={n.href} target="_blank" rel="noopener noreferrer nofollow">
          {renderBB(n.children, true)}
        </a>
      );
    }
    case 'list': {
      const items = n.items.map((it, j) => <li key={j}>{renderBB(it, inLink)}</li>);
      return n.ordered ? <ol key={key} class="bb-list">{items}</ol> : <ul key={key} class="bb-list">{items}</ul>;
    }
    case 'tag': {
      const kids = renderBB(n.children, inLink);
      switch (n.tag) {
        case 'b': return <b key={key}>{kids}</b>;
        case 'i': return <i key={key}>{kids}</i>;
        case 'u': return <u key={key}>{kids}</u>;
        case 's': return <s key={key}>{kids}</s>;
        case 'center': return <div key={key} class="bb-center">{kids}</div>;
        case 'color': return <span key={key} style={{ color: n.arg }}>{kids}</span>;
        case 'size': return <span key={key} style={{ fontSize: n.arg }}>{kids}</span>;
        case 'quote':
          return (
            <blockquote key={key} class="bb-quote">
              {n.arg && <div class="bb-quote-head"><b>{n.arg}</b> wrote:</div>}
              <div class="bb-quote-body">{kids}</div>
            </blockquote>
          );
        case 'spoiler': return <BBSpoiler key={key} title={n.arg}>{kids}</BBSpoiler>;
      }
    }
  }
  return null;
}

/** A link to one of our own forum threads (same site, #t/…): opened inside the game. */
function inAppThread(href: string): { thread: number; post?: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const u = new URL(href);
    if (u.origin !== window.location.origin) return null;
    return parseThreadHash(u.hash);
  } catch {
    return null;
  }
}

function BBSpoiler({ title, children }: { title?: string; children: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  return (
    <div class={`bb-spoiler ${open ? 'is-open' : ''}`}>
      <button type="button" class="bb-spoiler-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span class="bb-spoiler-caret" aria-hidden="true">▸</span>
        <span class="bb-spoiler-title">{title || 'Spoiler'}</span>
        <span class="bb-spoiler-hint">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div class="bb-spoiler-body">{children}</div>}
    </div>
  );
}

function BBCoord({ x, y }: { x: number; y: number }) {
  const pane = usePane();
  const map = host.value?.map();
  const off = !!map && (x >= map.size || y >= map.size);
  const v = map && !off ? villageAt(map, x, y) : undefined;
  if (off) return <span class="bb-coord is-off" title="Outside the realm">{coords(x, y)}</span>;
  return (
    <button
      type="button"
      class="link bb-coord"
      title={v ? `${v.name} (${coords(x, y)}): show on the map` : `Show ${coords(x, y)} on the map`}
      onClick={() => pane.go(v ? { name: 'map', focus: v.id } : { name: 'map', at: [x, y] })}
    >
      {v ? <>{v.name} <span class="coords">({coords(x, y)})</span></> : coords(x, y)}
    </button>
  );
}

function BBPlayer({ name }: { name: string }) {
  const pane = usePane();
  const map = host.value?.map();
  const key = name.toLowerCase();
  const p = map && Object.values(map.players).find((pp) => pp.name.toLowerCase() === key);
  if (!p) return <span class="bb-player is-unknown" title="No ruler by that name in this realm">{name}</span>;
  return <button type="button" class="link bb-player" title={`${p.name}'s profile`} onClick={() => pane.go({ name: 'ranking', player: p.id })}>{p.name}</button>;
}

function BBTribe({ tag }: { tag: string }) {
  const pane = usePane();
  const map = host.value?.map();
  const key = tag.toLowerCase();
  const t = map && Object.values(map.tribes).find((tt) => tt.tag.toLowerCase() === key);
  if (!t) return <span class="bb-tribe is-unknown">[{tag}]</span>;
  return <button type="button" class="link bb-tribe" title={t.name} onClick={() => pane.go({ name: 'tribe', id: t.id })}>[{t.tag}]</button>;
}

function BBThread({ id, post, label }: { id: number; post?: number; label?: string }) {
  const pane = usePane();
  const th = host.value?.tribeHome().tribe?.forum.find((x) => x.id === id);
  const text = label || (th ? th.title : 'Forum thread');
  return (
    <button
      type="button"
      class="link bb-thread"
      title={th ? `Open "${th.title}" in the tribe forum` : 'A tribe forum thread'}
      onClick={() => pane.go({ name: 'tribe', tab: 'forum', thread: id, ...(post ? { post } : {}) })}
    >
      <span aria-hidden="true">🔗</span> {th || label ? <>Thread: {text}</> : text}{post ? <span class="muted"> (a post)</span> : null}
    </button>
  );
}

