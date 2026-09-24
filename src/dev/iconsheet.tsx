import { render } from 'preact';
import { Icon, themedUnitIcon } from '../ui/art/icons';
import type { UnitId } from '../engine/types';

const q = new URLSearchParams(location.search);
const units = (q.get('u')?.split(',') ?? ['spear', 'sword', 'axe', 'archer', 'scout', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'noble', 'militia', 'paladin', 'sorcerer', 'druid', 'goblin', 'necromancer', 'orc', 'trader']) as UnitId[];
const big = Number(q.get('s') ?? 44);
const themes = ['classic', 'paladin', 'sorcerer', 'druid', 'goblin', 'necromancer', 'orc'] as const;
render(
  <table>
    <tr><th></th>{units.map((u) => <th>{u}</th>)}</tr>
    {themes.map((t) => (
      <tr><th>{t}</th>{units.map((u) => <td><Icon name={themedUnitIcon(u, t)} size={big} /><br /><Icon name={themedUnitIcon(u, t)} size={18} /></td>)}</tr>
    ))}
  </table>,
  document.getElementById('app')!,
);
