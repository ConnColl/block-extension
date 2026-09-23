import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { remainingMs } from '@/lib/session';
import { useFocus, useNow } from '@/lib/hooks';
import { formatRemaining } from '@/lib/time';
import { transition } from '@/lib/motion';

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
 * Placeholder Blocked page (step 2). Step 3 gives it its real design and motion.
 * Calm, factual, no shaming.
 */
export default function App() {
  const reduce = useReducedMotion();
  const now = useNow();
  const { session, task, loaded } = useFocus(now);
  const attempted = attemptedUrl();
  const host = attempted?.hostname.replace(/^www\./, '');

  const enter = { opacity: 0, y: reduce ? 0 : 8 };

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6 font-sans text-ink">
      <AnimatePresence mode="wait">
        {!loaded ? null : session && task ? (
          <motion.div
            key="focus"
            className="w-full max-w-md"
            initial={enter}
            animate={{ opacity: 1, y: 0, transition: transition.enter }}
            exit={{ opacity: 0, transition: transition.exit }}
          >
            <p className="text-sm text-muted">{host ? `${host} isn’t part of this task.` : 'This site isn’t part of this task.'}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{task.name}</h1>
            {task.why && <p className="mt-2 text-base text-muted">{task.why}</p>}
            <p className="mt-6 text-lg font-medium tabular-nums">{formatRemaining(remainingMs(session, now))}</p>

            <h2 className="mt-10 text-sm font-medium text-muted">Open during this task</h2>
            <ul className="mt-3 space-y-2">
              {task.allowedSites.map((site) => (
                <li key={site}>
                  <a href={`https://${site}`} className="text-base font-medium text-accent underline-offset-4 hover:underline">
                    {site}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : (
          <motion.div
            key="free"
            className="w-full max-w-md"
            initial={enter}
            animate={{ opacity: 1, y: 0, transition: transition.enter }}
            exit={{ opacity: 0, transition: transition.exit }}
          >
            <h1 className="text-3xl font-semibold tracking-tight">Your session is over.</h1>
            <p className="mt-3 text-base text-muted">Nothing is blocked right now.</p>
            {attempted && (
              <a
                href={attempted.href}
                className="mt-8 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90"
              >
                Continue to {host}
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
