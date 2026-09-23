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
