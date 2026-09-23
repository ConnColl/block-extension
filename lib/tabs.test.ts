import { describe, expect, it } from 'vitest';
import { countTabs, tabLimitMessage } from './tabs';

const BLOCKED = 'chrome-extension://abc/blocked.html';

describe('countTabs', () => {
  const tabs = [
    { id: 1, url: `${BLOCKED}#https://x.com/` }, // parked, still paused
    { id: 2, url: 'https://notion.so/' }, // was parked, user moved on → in use
    { id: 3, url: `${BLOCKED}#https://y.com/` }, // blocked during the session, not parked → in use
    { id: 4, url: 'https://figma.com/' },
    { id: 5, pendingUrl: 'chrome://newtab/' },
  ];
  const parked = { '1': 'https://x.com/', '2': 'https://notion.so/' };

  it('counts only parked tabs still on the Blocked page as paused', () => {
    expect(countTabs(tabs, parked, BLOCKED)).toEqual({ inUse: 4, paused: 1 });
  });
  it('counts everything as in use with nothing parked', () => {
    expect(countTabs(tabs, {}, BLOCKED)).toEqual({ inUse: 5, paused: 0 });
  });
});

describe('tabLimitMessage', () => {
  it('reads calmly at and over the limit', () => {
    expect(tabLimitMessage(5, 5)).toBe('5 of 5 tabs in use. Close one to open another.');
    expect(tabLimitMessage(7, 5)).toBe('7 tabs in use. The limit for this session is 5. Close some to open another.');
  });
});
