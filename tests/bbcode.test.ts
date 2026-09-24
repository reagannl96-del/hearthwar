import { describe, expect, it } from 'vitest';
import { applyAction } from '../src/engine/actions';
import { privatePacket, publicSnapshot } from '../src/engine/shadow';
import { FORUM_MAX_TEXT, cleanText } from '../src/engine/tribes';
import { buildView, tribeHome } from '../src/engine/view';
import { createWorld, defaultConfig, spawnPlayer } from '../src/engine/world';
import { excerpt, parseBBCode, parseThreadHash, safeUrl, stripBBCode, type BBNode } from '../src/ui/bbcode/parse';
import { appendQuote } from '../src/ui/bbcode/Editor';
import { renderBB } from '../src/ui/bbcode/render';

const P = parseBBCode;
const T = (v: string): BBNode => ({ t: 'text', v });

/** every text in a tree, joined: what a reader would see as plain letters */
function flat(nodes: BBNode[]): string {
  return nodes.map((n) => {
    switch (n.t) {
      case 'text': case 'code': return n.v;
      case 'tag': case 'link': return flat(n.children);
      case 'list': return n.items.map(flat).join('|');
      case 'coord': return `${n.x}|${n.y}`;
      case 'player': return n.name;
      case 'tribe': return n.tag;
      case 'thread': return String(n.id);
      case 'hr': return '---';
    }
  }).join('');
}

describe('BBCode parser: tags', () => {
  it('plain text stays plain', () => {
    expect(P('hello world')).toEqual([T('hello world')]);
    expect(P('')).toEqual([]);
  });

  it.each(['b', 'i', 'u', 's', 'center'])('[%s]', (tag) => {
    expect(P(`a [${tag}]x[/${tag}] b`)).toEqual([T('a '), { t: 'tag', tag, children: [T('x')] }, T(' b')]);
  });

  it('tags are case-insensitive', () => {
    expect(P('[B]x[/b]')).toEqual([{ t: 'tag', tag: 'b', children: [T('x')] }]);
  });

  it('[color] takes #hex and names, nothing else', () => {
    expect(P('[color=#ff0000]r[/color]')).toEqual([{ t: 'tag', tag: 'color', arg: '#ff0000', children: [T('r')] }]);
    expect(P('[color=#F00]r[/color]')[0]).toMatchObject({ t: 'tag', arg: '#f00' });
    expect(P('[color=red]r[/color]')[0]).toMatchObject({ t: 'tag', tag: 'color' });
    // anything that could break out of a style stays text
    expect(P('[color=red;background:url(x)]r[/color]')).toEqual([T('[color=red;background:url(x)]r[/color]')]);
    expect(P('[color=expression(alert(1))]r[/color]')).toEqual([T('[color=expression(alert(1))]r[/color]')]);
  });

  it('[size] takes small, large or 7-20', () => {
    expect(P('[size=small]s[/size]')[0]).toMatchObject({ t: 'tag', tag: 'size', arg: '0.82em' });
    expect(P('[size=large]s[/size]')[0]).toMatchObject({ arg: '1.3em' });
    expect(P('[size=12]s[/size]')[0]).toMatchObject({ arg: '12px' });
    expect(P('[size=200]s[/size]')).toEqual([T('[size=200]s[/size]')]);
    expect(P('[size=6]s[/size]')).toEqual([T('[size=6]s[/size]')]);
  });

  it('[quote] and [quote=Name]', () => {
    expect(P('[quote]hi[/quote]')).toEqual([{ t: 'tag', tag: 'quote', children: [T('hi')] }]);
    expect(P('[quote=Alda]hi[/quote]')).toEqual([{ t: 'tag', tag: 'quote', arg: 'Alda', children: [T('hi')] }]);
    expect(P('[quote="Iron Alda"]hi[/quote]')[0]).toMatchObject({ arg: 'Iron Alda' });
  });

  it('[spoiler] and [spoiler=Title]', () => {
    expect(P('[spoiler]boo[/spoiler]')).toEqual([{ t: 'tag', tag: 'spoiler', children: [T('boo')] }]);
    expect(P('[spoiler=The plan]boo[/spoiler]')[0]).toMatchObject({ tag: 'spoiler', arg: 'The plan' });
  });

  it('[code] keeps what is inside exactly, tags and all', () => {
    expect(P('[code][b]not bold[/b] 500|500[/code]')).toEqual([{ t: 'code', v: '[b]not bold[/b] 500|500' }]);
  });

  it('[url] and [url=…]', () => {
    expect(P('[url]https://example.com/a?b=1[/url]')).toEqual([{ t: 'link', href: 'https://example.com/a?b=1', children: [T('https://example.com/a?b=1')] }]);
    expect(P('[url=https://example.com]the [b]site[/b][/url]')).toEqual([
      { t: 'link', href: 'https://example.com/', children: [T('the '), { t: 'tag', tag: 'b', children: [T('site')] }] },
    ]);
    expect(P('[url=www.example.com]x[/url]')[0]).toMatchObject({ t: 'link', href: 'https://www.example.com/' });
  });

  it('[list][*]…[/list], with and without [/*]', () => {
    expect(P('[list][*]one[*]two[/list]')).toEqual([{ t: 'list', ordered: false, items: [[T('one')], [T('two')]] }]);
    expect(P('[list]\n[*]one\n[*]two\n[/list]')).toEqual([{ t: 'list', ordered: false, items: [[T('one')], [T('two')]] }]);
    expect(P('[list=1][*]a[/*][*]b[/*][/list]')).toEqual([{ t: 'list', ordered: true, items: [[T('a')], [T('b')]] }]);
    // [*] outside a list is just text
    expect(P('[*] star')).toEqual([T('[*] star')]);
  });

  it('[hr]', () => {
    expect(P('a[hr]b')).toEqual([T('a'), { t: 'hr' }, T('b')]);
    expect(P('a\n[hr]\nb')).toEqual([T('a'), { t: 'hr' }, T('b')]);
  });

  it('[coord] and [village] take coordinates', () => {
    expect(P('[coord]80|5[/coord]')).toEqual([{ t: 'coord', x: 80, y: 5 }]);
    expect(P('[village] 80 | 5 [/village]')).toEqual([{ t: 'coord', x: 80, y: 5, village: true }]);
    expect(P('[coord]nowhere[/coord]')).toEqual([T('[coord]nowhere[/coord]')]);
  });

  it('[player], [tribe] and [ally]', () => {
    expect(P('[player]Bram the Bold[/player]')).toEqual([{ t: 'player', name: 'Bram the Bold' }]);
    expect(P('[tribe]IRN[/tribe] and [ally][ABC][/ally]')).toEqual([{ t: 'tribe', tag: 'IRN' }, T(' and '), { t: 'tribe', tag: 'ABC' }]);
    expect(P('[player][/player]')).toEqual([T('[player][/player]')]);
  });

  it('[thread] links', () => {
    expect(P('[thread]42[/thread]')).toEqual([{ t: 'thread', id: 42 }]);
    expect(P('[thread=42/7]Our plans[/thread]')).toEqual([{ t: 'thread', id: 42, post: 7, label: 'Our plans' }]);
    expect(P('[thread]abc[/thread]')).toEqual([T('[thread]abc[/thread]')]);
  });
});

describe('BBCode parser: nesting and broken input', () => {
  it('nests', () => {
    expect(P('[b][i]x[/i][/b]')).toEqual([{ t: 'tag', tag: 'b', children: [{ t: 'tag', tag: 'i', children: [T('x')] }] }]);
    const q = P('[quote=A][quote=B]inner[/quote]outer[/quote]');
    expect(q[0]).toMatchObject({ t: 'tag', tag: 'quote', arg: 'A' });
    expect((q[0] as { children: BBNode[] }).children[0]).toMatchObject({ t: 'tag', tag: 'quote', arg: 'B' });
    expect(P('[spoiler][list][*][color=red]x[/color][/list][/spoiler]')[0]).toMatchObject({ tag: 'spoiler', children: [{ t: 'list' }] });
  });

  it('unclosed tags stay as text, and their contents still render', () => {
    expect(P('[b]never closed')).toEqual([T('[b]never closed')]);
    expect(P('[b]x [i]y[/b]')).toEqual([{ t: 'tag', tag: 'b', children: [T('x [i]y')] }]);
    expect(P('[quote]a [b]b[/b]')).toEqual([T('[quote]a '), { t: 'tag', tag: 'b', children: [T('b')] }]);
    expect(P('[code]no end')).toEqual([T('[code]no end')]);
  });

  it('stray closing tags and unknown tags stay as text', () => {
    expect(P('x[/b]y')).toEqual([T('x[/b]y')]);
    expect(P('[marquee]hi[/marquee]')).toEqual([T('[marquee]hi[/marquee]')]);
    // no pictures: the tag stays as typed (the address in it is still a plain link)
    const img = P('[img]https://x.com/a.png[/img]');
    expect(img[0]).toEqual(T('[img]'));
    expect(img[2]).toEqual(T('[/img]'));
    expect(P('[b=1]x[/b]')).toEqual([T('[b=1]x[/b]')]);
  });

  it('keeps every letter of the input somewhere', () => {
    const src = '[b]a[i]b[/b]c[/i] [color=nope]d[/color] [list]e';
    expect(flat(P(src))).toBe(src.replace(/\[b\]|\[\/b\]/g, ''));
  });

  it('survives deep nesting and floods of tags', () => {
    const deep = '[b]'.repeat(500) + 'x' + '[/b]'.repeat(500);
    const t0 = performance.now();
    const out = P(deep);
    expect(flat(out)).toContain('x');
    const flood = '[code]'.repeat(5000) + '[url]'.repeat(3000) + '[quote]'.repeat(3000);
    P(flood);
    P('['.repeat(20000));
    P('[b]'.repeat(10000));
    expect(performance.now() - t0).toBeLessThan(2000);
  });

  it('caps the input', () => {
    expect(flat(P('x'.repeat(50_000))).length).toBe(20_000);
  });
});

describe('BBCode parser: nothing unsafe gets through', () => {
  it('refuses links that are not http or https', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', '//evil.com', 'java\nscript:alert(1)', 'file:///c:/x']) {
      expect(safeUrl(bad)).toBeNull();
      const out = P(`[url=${bad}]x[/url]`);
      expect(out.some((n) => n.t === 'link')).toBe(false);
      expect(P(`[url]${bad}[/url]`).some((n) => n.t === 'link')).toBe(false);
    }
  });

  it('refuses links that try to break out of the attribute', () => {
    // the tag is refused; at most the plain address in the leftover text becomes a link
    for (const src of ['[url=https://x.com" onmouseover="alert(1)]x[/url]', "[url=https://x.com'onclick='1]x[/url]"]) {
      const links = P(src).filter((n): n is Extract<BBNode, { t: 'link' }> => n.t === 'link');
      expect(links.every((l) => l.auto && l.href === 'https://x.com/')).toBe(true);
      expect(flat(P(src))).toBe(src);
    }
  });

  it('html in a post is only ever text', () => {
    expect(P('<script>alert(1)</script>')).toEqual([T('<script>alert(1)</script>')]);
    expect(P('[b]<img src=x onerror=alert(1)>[/b]')).toEqual([{ t: 'tag', tag: 'b', children: [T('<img src=x onerror=alert(1)>')] }]);
  });

  it('links drawn open in a new tab without handing over the page', () => {
    const [a] = renderBB(P('[url=https://example.com]x[/url]')) as { type: string; props: Record<string, unknown> }[];
    expect(a.type).toBe('a');
    expect(a.props.href).toBe('https://example.com/');
    expect(a.props.target).toBe('_blank');
    expect(a.props.rel).toBe('noopener noreferrer nofollow');
    expect(Object.keys(a.props).some((k) => k.startsWith('on') || k === 'dangerouslySetInnerHTML')).toBe(false);
  });

  it('never renders raw html', () => {
    const tree = JSON.stringify(renderBB(P('[b]<i>x</i>[/b][quote=<b>]y[/quote][color=red]z[/color]')), (k, v) => (k === '__o' || k === '_owner' ? undefined : v));
    expect(tree).not.toContain('dangerouslySetInnerHTML');
  });

  it('no links inside links', () => {
    const out = P('[url=https://a.com][url=https://b.com]x[/url][/url]');
    expect(out[0]).toMatchObject({ t: 'link', href: 'https://a.com/' });
    expect(JSON.stringify(out)).not.toContain('b.com/"');
  });
});

describe('BBCode: bare coordinates and links', () => {
  it('links bare coordinates, as Tribal Wars does', () => {
    expect(P('hit 512|498 now')).toEqual([T('hit '), { t: 'coord', x: 512, y: 498 }, T(' now')]);
    expect(P('(1|2),3|4')).toEqual([T('('), { t: 'coord', x: 1, y: 2 }, T('),'), { t: 'coord', x: 3, y: 4 }]);
    expect(P('[b]5|5[/b]')).toEqual([{ t: 'tag', tag: 'b', children: [{ t: 'coord', x: 5, y: 5 }] }]);
  });

  it('leaves things that only look like coordinates', () => {
    expect(P('1234|5 and 1|2|3 and 12||3')).toEqual([T('1234|5 and 1|2|3 and 12||3')]);
    expect(P('[code]5|5[/code]')).toEqual([{ t: 'code', v: '5|5' }]);
  });

  it('links bare web addresses (without the full stop after)', () => {
    expect(P('see https://example.com/x.')).toEqual([T('see '), { t: 'link', href: 'https://example.com/x', children: [T('https://example.com/x')], auto: true }, T('.')]);
    expect(P('javascript:alert(1)')).toEqual([T('javascript:alert(1)')]);
  });

  it('reads thread links', () => {
    expect(parseThreadHash('#t/12')).toEqual({ thread: 12 });
    expect(parseThreadHash('#t/12/34')).toEqual({ thread: 12, post: 34 });
    expect(parseThreadHash('#access_token=abc&t/1')).toBeNull();
    expect(parseThreadHash('#t/x')).toBeNull();
  });
});

describe('stripBBCode', () => {
  it('takes the tags out', () => {
    expect(stripBBCode('[b]Hello[/b] [color=red]there[/color], [coord]5|5[/coord]')).toBe('Hello there, 5|5');
    expect(stripBBCode('[url=https://x.com]site[/url] [player]Bram[/player] [tribe]IRN[/tribe]')).toBe('site Bram [IRN]');
  });
  it('keeps spoilers secret and leaves quotes out', () => {
    expect(stripBBCode('[spoiler=Plan]attack at dawn[/spoiler] ok')).toBe('(spoiler: Plan) ok');
    expect(stripBBCode('[quote=A]old words[/quote]I agree')).toBe('I agree');
  });
  it('keeps broken tags as typed', () => {
    expect(stripBBCode('[b]unclosed')).toBe('[b]unclosed');
  });
  it('makes one-line excerpts', () => {
    expect(excerpt('[b]a[/b]\n\nb', 20)).toBe('a b');
    expect(excerpt('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('quoting a post', () => {
  it('adds the quote after what is already written', () => {
    expect(appendQuote('', 'Alda', 'hello')).toBe('[quote=Alda]hello[/quote]\n');
    expect(appendQuote('hi', 'Al[da]', ' x ')).toBe('hi\n[quote=Alda]x[/quote]\n');
  });
});

describe('forum text on the server', () => {
  function world() {
    const w = createWorld({ worldName: 'T', playerName: '', villageName: '', multiplayer: true, seed: 3, config: { ...defaultConfig(), aiCount: 4, size: 60 } });
    const a = spawnPlayer(w, 'Alda', 'A')!;
    const b = spawnPlayer(w, 'Bram', 'B')!;
    return { w, a, b };
  }

  it('keeps posts as plain text, tags and line breaks and all', () => {
    const { w, a } = world();
    applyAction(w, a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' });
    const text = '[b]Plan[/b]\r\n[spoiler]<script>x</script>[/spoiler]\u0000';
    expect(applyAction(w, a.id, { type: 'forumThread', title: 'T', text }).ok).toBe(true);
    expect(w.tribes[a.tribeId!].forum![0].posts[0].text).toBe('[b]Plan[/b]\n[spoiler]<script>x</script>[/spoiler]');
    expect(cleanText('x'.repeat(9000), FORUM_MAX_TEXT).length).toBe(5000);
  });

  it('shows no other tribe\'s forum to a non-member', () => {
    const { w, a, b } = world();
    const tid = applyAction(w, a.id, { type: 'tribeCreate', name: 'Iron Oath', tag: 'IRN' }).data as number;
    const thread = applyAction(w, a.id, { type: 'forumThread', title: 'Secret plans', text: 'attack 5|5' }).data as number;
    applyAction(w, b.id, { type: 'tribeCreate', name: 'Crows', tag: 'CRW' });
    // Bram, in another tribe: nothing of Iron Oath's forum anywhere he can see
    expect(tribeHome(w, b.id).tribe!.forum.some((th) => th.id === thread)).toBe(false);
    expect(JSON.stringify(buildView(w, b.id))).not.toContain('Secret plans');
    expect(JSON.stringify(privatePacket(w, b.id))).not.toContain('Secret plans');
    expect(JSON.stringify(publicSnapshot(w))).not.toContain('Secret plans');
    expect(publicSnapshot(w).world.tribes[tid].forum).toEqual([]);
    // and a member does see it
    expect(tribeHome(w, a.id).tribe!.forum.some((th) => th.id === thread)).toBe(true);
  });
});
