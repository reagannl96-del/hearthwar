import type { Report } from '../engine/types';
import { isSrr } from '../engine/actions';
import { lsGet, lsSet } from '../host/storage';

export { isSrr };

const SRR_KEY = 'hw-hide-srr';
/** Whether the player filters SRRs out (deleted as they arrive, left out of counts and pop-ups), saved on this device. */
export const hideSrrs = () => lsGet(SRR_KEY) === '1';
export const setHideSrrs = (on: boolean) => lsSet(SRR_KEY, on ? '1' : '0');
/** Reports that still count: everything, or everything but SRRs while they are filtered. */
export const shownReports = (list: Report[]) => (hideSrrs() ? list.filter((r) => !isSrr(r)) : list);
