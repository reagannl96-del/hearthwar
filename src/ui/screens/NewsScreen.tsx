import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { Icon } from '../art/icons';
import { Empty, Section } from '../components/common';
import { fmtAgo } from '../format';
import { host, now, view, usePane } from '../store';

type Link = { kind: 'player'; id: number } | { kind: 'tribe'; id: number } | { kind: 'village'; id: number };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The heralds' cries about a resource cache (found, held, gone unclaimed, or fought over) wear the chest. */
export const isCacheNews = (text: string) => /resource cache/i.test(text);

export function NewsScreen() {
  const pane = usePane();
  const pv = view.value!;
  const map = host.value!.map();
  // everything the heralds might name: rulers, tribes (by name and by [TAG]) and villages (by their coordinates)
  const index = useMemo(() => {
    const names = new Map<string, Link>();
    for (const p of Object.values(map.players)) names.set(p.name, { kind: 'player', id: p.id });
    for (const t of Object.values(map.tribes)) {
      names.set(t.name, { kind: 'tribe', id: t.id });
      names.set(`[${t.tag}]`, { kind: 'tribe', id: t.id });
    }
    const at = new Map<string, number>();
    for (const v of map.villages) at.set(`${v.x}|${v.y}`, v.id);
    // longest first, so "The Ashen Ravens" wins over a ruler called "Ashen"
    const keys = [...names.keys()].filter((k) => k.length >= 2).sort((a, b) => b.length - a.length).map(escape);
    // coordinates in brackets, "(12|34)", or bare after a word, "at 12|34"
    const re = new RegExp(`(\\(\\d+\\|\\d+\\)|\\b\\d+\\|\\d+\\b)${keys.length ? `|(${keys.join('|')})` : ''}`, 'g');
    return { names, at, re };
  }, [map.rev]);

  const go = (l: Link) => {
    if (l.kind === 'player') pane.go({ name: 'ranking', player: l.id });
    else if (l.kind === 'tribe') pane.go({ name: 'tribe', id: l.id });
    else pane.go({ name: 'map', focus: l.id });
  };

  /** A herald's line with every ruler, tribe and village in it made a link. */
  const linked = (text: string): ComponentChildren[] => {
    const out: ComponentChildren[] = [];
    let last = 0;
    index.re.lastIndex = 0;
    for (let m = index.re.exec(text); m; m = index.re.exec(text)) {
      const [whole, coords] = m;
      let link: Link | undefined;
      if (coords) {
        const vid = index.at.get(coords.replace(/[()]/g, ''));
        if (vid !== undefined) link = { kind: 'village', id: vid };
      } else {
        // a ruler's name at the start of a village's name ("Wanderer's hold") is the village, not the ruler,
        // and a name inside a longer word is not a name at all
        const after = text.slice(m.index + whole.length, m.index + whole.length + 2);
        const before = text[m.index - 1] ?? ' ';
        if (after.startsWith("'s") || /[A-Za-z0-9]/.test(before) || /^[A-Za-z0-9]/.test(after)) continue;
        link = index.names.get(whole);
      }
      if (!link) continue;
      if (m.index > last) out.push(text.slice(last, m.index));
      const l = link;
      out.push(<button type="button" class={`link news-link news-link-${l.kind}`} onClick={() => go(l)}>{whole}</button>);
      last = m.index + whole.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  return (
    <div class="stack">
      <div class="page-head"><h1>Chronicle</h1><span class="muted">What the heralds are shouting across the realm.</span></div>
      <Section>
        {pv.news.length === 0 ? <Empty>The realm is quiet. For now.</Empty> : (
          <ul class="news">
            {pv.news.map((n) => (
              <li class={`news-item news-${n.kind}${isCacheNews(n.text) ? ' news-cache' : ''}`}>
                {isCacheNews(n.text) && <Icon name="cache" size={20} class="news-icon" title="Resource cache" />}
                <span class="grow">{linked(n.text)}</span>
                {n.vid !== undefined && <button type="button" class="link small" onClick={() => pane.go({ name: 'map', focus: n.vid })}>map</button>}
                <span class="muted small">{fmtAgo(n.t, now.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
