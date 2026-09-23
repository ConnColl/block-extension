import { storage } from 'wxt/utils/storage';
import type { ParkedTabs } from './session';

/** tabId → original URL of tabs parked at session start. Session storage: tab ids only last while Chrome runs. */
export const parkedTabsItem = storage.defineItem<ParkedTabs>('session:parkedTabs', { fallback: {} });

/** Maximum tabs in use during a session. A policy constant. */
export const TAB_LIMIT = 5;

/** How long the tab-limit notice stays up (paused while hovered or focused). A reading window, not a motion token. */
export const TAB_NOTICE_MS = 6000;

/** After Chrome starts, restored tabs aren't closed for this long. */
export const STARTUP_GRACE_MS = 10_000;

export interface TabLike {
  id?: number;
  url?: string;
  pendingUrl?: string;
}

/**
 * Tabs in use vs. paused. A tab is paused while it's parked *and* still on the
 * Blocked page; once the user takes it somewhere allowed, it's in use again.
 */
export function countTabs(tabs: TabLike[], parked: ParkedTabs, blockedPage: string) {
  let paused = 0;
  for (const tab of tabs) {
    const url = tab.url || tab.pendingUrl || '';
    if (tab.id !== undefined && String(tab.id) in parked && url.startsWith(blockedPage)) paused++;
  }
  return { inUse: tabs.length - paused, paused };
}

/** Payload for the "5 of 5 tabs in use" notice. */
export interface TabLimitNotice {
  type: 'notice/tab-limit';
  /** Tab that should show it. */
  targetTabId: number;
  inUse: number;
  limit: number;
  /** The closed tab's URL, offered as "Open here instead" when it's on the allowlist. */
  openHereUrl?: string;
}

export function tabLimitMessage(inUse: number, limit: number): string {
  return inUse > limit
    ? `${inUse} tabs in use. The limit for this session is ${limit}. Close some to open another.`
    : `${inUse} of ${limit} tabs in use. Close one to open another.`;
}
