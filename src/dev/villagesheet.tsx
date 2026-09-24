import { villageSprite, VILLAGE_STAGES, type VillageLook } from '../ui/mapSprites';

// Dev: every village sprite, large and at map size. /dev/villagesheet.html?s=120&m=44
const q = new URLSearchParams(location.search);
const big = Number(q.get('s') ?? 120);
const small = Number(q.get('m') ?? 44);
const app = document.getElementById('app')!;
app.style.background = '#6f8f3a';
app.style.padding = '8px';
const rows: [string, VillageLook, { barb?: boolean; ground?: 'grass' | 'snow' | 'ash' }][] = [
  ['generic', 'generic', {}], ['barbarian', 'generic', { barb: true }], ['snow', 'generic', { ground: 'snow' }], ['ash', 'generic', { ground: 'ash' }],
  ['paladin', 'paladin', {}], ['sorcerer', 'sorcerer', {}], ['druid', 'druid', {}], ['goblin', 'goblin', {}], ['necromancer', 'necromancer', {}],
  ['necro snow', 'necromancer', { ground: 'snow' }], ['druid ash', 'druid', { ground: 'ash' }],
];
const paint = () => {
  app.innerHTML = '';
  for (const [name, look, opts] of rows) {
    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.alignItems = 'flex-end'; row.style.gap = '4px';
    const label = document.createElement('div'); label.textContent = name; label.style.width = '80px'; label.style.color = '#fff'; label.style.font = '12px sans-serif';
    row.appendChild(label);
    for (let t = 0; t < VILLAGE_STAGES; t++) {
      const src = villageSprite(t, look, opts);
      for (const sz of [big, small]) {
        const c = document.createElement('canvas');
        c.width = c.height = sz;
        if (src) c.getContext('2d')!.drawImage(src, 0, 0, sz, sz);
        row.appendChild(c);
      }
    }
    app.appendChild(row);
  }
};
paint();
setTimeout(paint, 800);
