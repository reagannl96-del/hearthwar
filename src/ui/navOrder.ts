// The order of the main tabs, as the player has dragged them (kept in this browser only).

import { lsGet, lsSet } from '../host/storage';

const NAV_KEY = 'hw-nav-order';
export function navOrder(): string[] {
  try {
    const v = JSON.parse(lsGet(NAV_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}
export function saveNavOrder(keys: string[]): void {
  lsSet(NAV_KEY, JSON.stringify(keys));
}
/** Put the tabs back in their usual order (from the settings page). */
export function resetNavOrder(): void {
  lsSet(NAV_KEY, '[]');
  window.dispatchEvent(new Event('hw-nav-reset'));
}
