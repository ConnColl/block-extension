import { useEffect } from 'react';
import { browser } from 'wxt/browser';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { remainingMs, sessionProgress } from '@/lib/session';
import { useFocus, useNow } from '@/lib/hooks';
import { formatRemaining, formatTime } from '@/lib/time';
import { duration, easing, transition } from '@/lib/motion';
import { SiteIcon } from '@/components/SiteIcon';
import { copy } from '@/lib/copy';
import { useTabCounts } from '@/lib/useTabCounts';
import { useTabLimitNotices } from '@/lib/useTabLimitNotices';

const OVERRIDE_URL = browser.runtime.getURL('/override.html');

/** The page the user was heading to, carried in the hash by the redirect rule. */
function attemptedUrl(): URL | null {
  const raw = location.hash.slice(1);
  for (const candidate of [raw, safeDecode(raw)]) {
    try {
      const url = new URL(candidate);
      if (/^https?:$/.test(url.protocol)) return url;
    } catch {
      // try the next form
    }
  }
  return null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Signature moment 3: hitting a blocked site. A door gently closing, not an alarm.
 * The page fades in, then each line settles in reading order.
 */
function useEntrance(reduce: boolean | null) {
  const container: Variants = {
    hidden: {},
    show: { transition: reduce ? {} : { staggerChildren: duration.instant } },
    exit: { opacity: 0, transition: transition.exit },
  };
  const item: Variants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: transition.enter } };
  return { container, item };
}

export default function App() {
  useTabLimitNotices();
  const reduce = useReducedMotion();
  const now = useNow();
  const { session, task, loaded } = useFocus(now);
  const attempted = attemptedUrl();
  const host = attempted?.hostname.replace(/^www\./, '');
  const { container, item } = useEntrance(reduce);
  const tabs = useTabCounts();

  useEffect(() => {
    document.title = task ? `${task.name} · Block` : 'Block';
  }, [task?.name]);

  return (
    <motion.main
      className="min-h-screen bg-bg px-6 font-sans text-ink"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: duration.emphasized, ease: easing.enter }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center py-20">
        <AnimatePresence mode="wait">
          {!loaded ? null : session && task ? (
            <motion.div key={`focus-${task.id}`} variants={container} initial="hidden" animate="show" exit="exit">
              <motion.p variants={item} className="text-base text-muted">
                {copy.blockedLine} {copy.blockedLead}
              </motion.p>

              <motion.h1 variants={item} className="mt-3 text-4xl leading-tight font-semibold tracking-tight">
                “{task.name}.”
              </motion.h1>

              {task.why && (
                <motion.p variants={item} className="mt-3 text-lg text-muted">
                  {task.why}
                </motion.p>
              )}

              <motion.div variants={item} className="mt-10">
                <p className="text-base">
                  <span className="font-medium tabular-nums">{formatRemaining(remainingMs(session, now))}</span>
                  <span className="text-muted"> · until {formatTime(task.end)}</span>
                </p>
                <div aria-hidden="true" className="mt-3 h-0.5 overflow-hidden rounded-full bg-line">
                  <motion.div
                    className="h-full origin-left rounded-full bg-accent"
                    initial={{ scaleX: reduce ? sessionProgress(session, now) : 0 }}
                    animate={{ scaleX: sessionProgress(session, now) }}
                    transition={{ duration: duration.emphasized, ease: easing.linear }}
                  />
                </div>
              </motion.div>

              <motion.section variants={item} aria-labelledby="allowed-heading" className="mt-12">
                <h2 id="allowed-heading" className="text-sm font-medium text-muted">
                  Open during this task
                </h2>
                <ul className="mt-3 space-y-1">
                  {task.allowedSites.map((site) => (
                    <li key={site}>
                      <a
                        href={`https://${site}`}
                        className="group -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-base font-medium text-ink hover:bg-surface"
                      >
                        <SiteIcon domain={site} />
                        <span>{site}</span>
                        <span
                          aria-hidden="true"
                          className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                        >
                          →
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.section>

              {tabs && tabs.paused > 0 && (
                <motion.p variants={item} className="mt-10 text-sm text-muted">
                  {copy.parked(tabs.paused)}
                </motion.p>
              )}

              <motion.p variants={item} className={tabs && tabs.paused > 0 ? 'mt-12' : 'mt-20'}>
                <a
                  href={OVERRIDE_URL}
                  className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  End this session early
                </a>
              </motion.p>
            </motion.div>
          ) : (
            <motion.div key="over" variants={container} initial="hidden" animate="show" exit="exit">
              <motion.h1 variants={item} className="text-4xl leading-tight font-semibold tracking-tight">
                {copy.welcomeTitle}
              </motion.h1>
              <motion.p variants={item} className="mt-3 text-lg text-muted">
                {copy.welcomeBody}
              </motion.p>
              {attempted && (
                <motion.div variants={item} className="mt-10">
                  <a
                    href={attempted.href}
                    className="inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90"
                  >
                    Continue to {host}
                  </a>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.main>
  );
}
