import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { suggestDomains } from './domains';

/** Domains from the user's open tabs, most recent first, refreshed when tabs change. */
export function useOpenTabDomains(exclude: string[]): string[] {
  const [tabs, setTabs] = useState<{ url?: string; lastAccessed?: number }[]>([]);

  useEffect(() => {
    const load = () => void browser.tabs.query({}).then(setTabs, () => {});
    load();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    browser.tabs.onUpdated.addListener(load);
    browser.tabs.onRemoved.addListener(load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      browser.tabs.onUpdated.removeListener(load);
      browser.tabs.onRemoved.removeListener(load);
    };
  }, []);

  return suggestDomains(tabs, exclude);
}
