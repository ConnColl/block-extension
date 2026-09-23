import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { countTabs, parkedTabsItem } from './tabs';

const BLOCKED_PAGE = browser.runtime.getURL('/blocked.html');

/** Tabs in use and paused (parked), kept live. */
export function useTabCounts() {
  const [counts, setCounts] = useState<{ inUse: number; paused: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      const [tabs, parked] = await Promise.all([
        browser.tabs.query({ windowType: 'normal' }),
        parkedTabsItem.getValue(),
      ]);
      setCounts(countTabs(tabs, parked, BLOCKED_PAGE));
    };
    const reload = () => void load();
    reload();
    browser.tabs.onCreated.addListener(reload);
    browser.tabs.onRemoved.addListener(reload);
    browser.tabs.onUpdated.addListener(reload);
    const unwatch = parkedTabsItem.watch(reload);
    return () => {
      browser.tabs.onCreated.removeListener(reload);
      browser.tabs.onRemoved.removeListener(reload);
      browser.tabs.onUpdated.removeListener(reload);
      unwatch();
    };
  }, []);

  return counts;
}
