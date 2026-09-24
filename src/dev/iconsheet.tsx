import { render } from 'preact';
import { Icon, themedUnitIcon } from '../ui/art/icons';
import type { UnitId } from '../engine/types';
import type { VillageTheme } from '../engine/data/themes';

// /dev/iconsheet.html — every troop icon in every village style, big and at list size.
//   ?s=64            the big size (default 44)
//   ?u=spear,light   only these troops (a hero name shows that hero's own icon)
//   ?t=frost,dwarf   only these village styles
//   ?dark=1          on a dark ground, as in the night theme
const q = new URLSearchParams(location.search);
const units = (q.get('u')?.split(',') ?? ['spear', 'sword', 'axe', 'archer', 'scout', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'noble', 'militia', 'trader', 'paladin', 'sorcerer', 'druid', 'goblin', 'necromancer', 'orc', 'frost', 'dwarf', 'djinn', 'saurian']) as UnitId[];
const big = Number(q.get('s') ?? 44);
const ALL: VillageTheme[] = ['classic', 'paladin', 'sorcerer', 'druid', 'goblin', 'necromancer', 'orc', 'frost', 'dwarf', 'djinn', 'saurian'];
const themes = (q.get('t')?.split(',') as VillageTheme[] | undefined) ?? ALL;
if (q.get('dark')) document.body.classList.add('dark');
render(
  <table>
    <tr><th></th>{units.map((u) => <th>{u}</th>)}</tr>
    {themes.map((t) => (
      <tr><th>{t}</th>{units.map((u) => <td><Icon name={themedUnitIcon(u, t)} size={big} /><br /><Icon name={themedUnitIcon(u, t)} size={18} /></td>)}</tr>
    ))}
  </table>,
  document.getElementById('app')!,
);
