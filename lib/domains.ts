/**
 * Normalize user input like "https://www.Notion.so/page" to "notion.so".
 * Returns null if the input isn't a plausible domain.
 */
export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) value = `https://${value}`;

  let host: string;
  try {
    host = new URL(value).hostname;
  } catch {
    return null;
  }

  host = host.replace(/^www\./, '').replace(/\.$/, '');

  // Require at least one dot and valid labels (e.g. "docs.google.com").
  const label = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
  const parts = host.split('.');
  if (parts.length < 2 || !parts.every((p) => label.test(p))) return null;
  const tld = parts[parts.length - 1] ?? '';
  if (!/^[a-z]{2,}$|^xn--/.test(tld)) return null;

  return host;
}

/** True if `host` is an allowed domain or a subdomain of one. */
export function isAllowedHost(host: string, allowedSites: string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return allowedSites.some((site) => h === site || h.endsWith(`.${site}`));
}

/**
 * One-click suggestions from open tabs: normalized domains of http(s) tabs,
 * most recently used first, excluding ones already added.
 */
export function suggestDomains(
  tabs: { url?: string; lastAccessed?: number }[],
  exclude: string[],
  limit = 8,
): string[] {
  const seen = new Set(exclude);
  const out: string[] = [];
  for (const tab of [...tabs].sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))) {
    if (!tab.url || !/^https?:\/\//.test(tab.url)) continue;
    const domain = normalizeDomain(tab.url);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    out.push(domain);
    if (out.length === limit) break;
  }
  return out;
}
