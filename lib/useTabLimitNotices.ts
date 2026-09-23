import { useEffect } from 'react';
import { browser } from 'wxt/browser';
import { showTabLimitNotice } from './tabLimitNotice';
import type { TabLimitNotice } from './tabs';

/**
 * Block's own pages (plan, Blocked, override) don't get content scripts, so they
 * listen for the tab-limit broadcast and show it if it's meant for their tab.
 */
export function useTabLimitNotices() {
  useEffect(() => {
    let myTabId: number | undefined;
    void browser.tabs.getCurrent().then((tab) => (myTabId = tab?.id));
    const onMessage = (msg: TabLimitNotice) => {
      if (msg?.type === 'notice/tab-limit' && msg.targetTabId === myTabId) showTabLimitNotice(msg);
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, []);
}
