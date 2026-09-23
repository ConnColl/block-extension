import { browser } from 'wxt/browser';

const getURL = browser.runtime.getURL as (path: string) => string;

/**
 * A domain's favicon from Chrome's own favicon cache (the `favicon` permission),
 * so no site list is ever sent to a third-party icon service. Sites Chrome has
 * never seen show its generic globe.
 */
export function SiteIcon({ domain, size = 16 }: { domain: string; size?: number }) {
  const src = new URL(getURL('/_favicon/'));
  src.searchParams.set('pageUrl', `https://${domain}`);
  src.searchParams.set('size', String(size * 2));
  return <img src={src.toString()} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-sm" />;
}
