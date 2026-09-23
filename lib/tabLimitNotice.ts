import { showNotice, type Notice } from './notice';

let current: Notice | null = null;
import { TAB_NOTICE_MS, tabLimitMessage, type TabLimitNotice } from './tabs';

/** Signature moment 4: reaching the tab limit. Calm, with a way forward. */
export function showTabLimitNotice(msg: TabLimitNotice) {
  const url = msg.openHereUrl ? safeUrl(msg.openHereUrl) : null;
  const where = url ? url.hostname.replace(/^www\./, '') + (url.pathname === '/' ? '' : url.pathname) : '';
  // Hitting the limit again replaces the notice rather than stacking another.
  current?.remove(true);
  current = showNotice({
    title: [tabLimitMessage(msg.inUse, msg.limit)],
    meter: { filled: Math.min(msg.inUse, msg.limit), total: msg.limit },
    action: url
      ? { label: 'Open here instead', ariaLabel: `Open ${where} here instead`, onClick: () => location.assign(url.href) }
      : undefined,
    closeLabel: 'Hide this notice',
    autoHideMs: TAB_NOTICE_MS,
  });
}

function safeUrl(s: string): URL | null {
  try {
    return new URL(s);
  } catch {
    return null;
  }
}
