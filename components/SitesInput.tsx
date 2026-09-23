import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { normalizeDomain } from '@/lib/domains';
import { transition } from '@/lib/motion';
import { useOpenTabDomains } from '@/lib/useOpenTabDomains';
import { SiteIcon } from './SiteIcon';

interface Props {
  id: string;
  sites: string[];
  onSitesChange: (sites: string[]) => void;
  text: string;
  onTextChange: (text: string) => void;
  /** Called with a message when an entry can't be added, or null to clear it. */
  onEntryError: (message: string | null) => void;
  describedBy?: string;
  invalid?: boolean;
}

/** Commits free text to the site list. Returns false if the text wasn't a valid site. */
export function commitSiteText(
  text: string,
  sites: string[],
): { ok: true; sites: string[] } | { ok: false; message: string } {
  const entries = text.split(/[\s,]+/).filter(Boolean);
  const next = [...sites];
  for (const entry of entries) {
    const domain = normalizeDomain(entry);
    if (!domain) return { ok: false, message: `“${entry}” doesn’t look like a website. Try something like notion.so.` };
    if (!next.includes(domain)) next.push(domain);
  }
  return { ok: true, sites: next };
}

export function SitesInput({ id, sites, onSitesChange, text, onTextChange, onEntryError, describedBy, invalid }: Props) {
  const reduce = useReducedMotion();
  const suggestions = useOpenTabDomains(sites);

  function commit() {
    const result = commitSiteText(text, sites);
    if (!result.ok) {
      onEntryError(result.message);
      return;
    }
    onEntryError(null);
    onSitesChange(result.sites);
    onTextChange('');
  }

  return (
    <div>
      <input
        id={id}
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="notion.so, figma.com"
        value={text}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          onTextChange(e.target.value);
          onEntryError(null);
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={() => text.trim() && commit()}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 aria-invalid:border-notice"
      />
      {sites.length > 0 && (
        <ul aria-label="Allowed sites" className="mt-3 flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {sites.map((site) => (
              <motion.li
                key={site}
                layout={!reduce}
                initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                animate={{ opacity: 1, scale: 1, transition: transition.enter }}
                exit={{ opacity: 0, transition: transition.exit }}
                transition={transition.spring}
                className="flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-2.5 pr-1 text-sm text-ink"
              >
                <SiteIcon domain={site} />
                {site}
                <button
                  type="button"
                  aria-label={`Remove ${site}`}
                  onClick={() => onSitesChange(sites.filter((s) => s !== site))}
                  className="grid size-6 place-items-center rounded-full text-muted hover:bg-bg hover:text-ink"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {suggestions.length > 0 && (
        <div className="mt-4">
          <p id={`${id}-suggestions`} className="text-xs font-medium text-muted">
            From your open tabs
          </p>
          <ul aria-labelledby={`${id}-suggestions`} className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((site) => (
              <li key={site}>
                <button
                  type="button"
                  aria-label={`Add ${site}`}
                  onClick={() => {
                    onEntryError(null);
                    onSitesChange([...sites, site]);
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-dashed border-line py-1 pr-3 pl-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-ink"
                >
                  <span aria-hidden="true">+</span>
                  <SiteIcon domain={site} />
                  {site}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
