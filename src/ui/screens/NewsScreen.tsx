import { Empty, Section } from '../components/common';
import { fmtAgo } from '../format';
import { go, now, view } from '../store';

export function NewsScreen() {
  const pv = view.value!;
  return (
    <div class="stack">
      <div class="page-head"><h1>Chronicle</h1><span class="muted">What the heralds are shouting across the realm.</span></div>
      <Section>
        {pv.news.length === 0 ? <Empty>The realm is quiet. For now.</Empty> : (
          <ul class="news">
            {pv.news.map((n) => (
              <li class={`news-item news-${n.kind}`}>
                <span class="grow">{n.text}</span>
                {n.vid !== undefined && <button type="button" class="link small" onClick={() => go({ name: 'map', focus: n.vid })}>map</button>}
                <span class="muted small">{fmtAgo(n.t, now.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
