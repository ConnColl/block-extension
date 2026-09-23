import { useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ActiveSession, Task } from '@/lib/tasks';
import type { TaskOutcome } from '@/lib/override';
import {
  AD_BREAK_MS,
  AD_PORT,
  AD_SPOT_COUNT,
  BREATHING_SPOT_MS,
  DEV_AD_SPOT_COUNT,
  completedThisWeek,
  planAdBreak,
  spotAt,
} from '@/lib/adbreak';
import { formatCountdown, remainingMs } from '@/lib/session';
import { transition } from '@/lib/motion';
import { AdSpot, SPOT_NAMES, SpotProgress } from './AdSpots';

/** The ad break's own clock ticks faster than the page clock so spot changes land on time. */
const AD_TICK_MS = 250;
/** Keeps the background worker awake while the break runs. */
const PING_MS = 20_000;

export type AdBreakResult = { kind: 'ended' } | { kind: 'outlasted' } | { kind: 'refused'; error: string };

interface Props {
  task: Task;
  session: ActiveSession | null;
  tasks: Task[];
  outcomes: Record<string, TaskOutcome>;
  onFinish: (result: AdBreakResult) => void;
}

/**
 * Step 5c: the 10-minute unskippable ad break. "Ads" built only from the user's
 * own data; sponsored only by Morning You. The background times it, so leaving
 * the page resets it and the session only ends once it has really run.
 */
export function AdBreak({ task, session, tasks, outcomes, onFinish }: Props) {
  const reduce = useReducedMotion();
  const [run, setRun] = useState<{ startedAt: number; durationMs: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const port = useRef<Browser.runtime.Port | null>(null);
  const sentComplete = useRef(0);
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const finish = (r: AdBreakResult) => {
    if (finished.current) return;
    finished.current = true;
    onFinishRef.current(r);
  };

  // Hold the break open with the background for as long as this page is here.
  useEffect(() => {
    const p = browser.runtime.connect({ name: AD_PORT });
    port.current = p;
    p.onMessage.addListener((msg: { type: string; startedAt?: number; durationMs?: number; error?: string }) => {
      if (msg.type === 'started') setRun({ startedAt: msg.startedAt!, durationMs: msg.durationMs! });
      else if (msg.type === 'ended') finish({ kind: 'ended' });
      else if (msg.type === 'outlasted') finish({ kind: 'outlasted' });
      else if (msg.type === 'refused') finish({ kind: 'refused', error: msg.error ?? 'The ad break couldn’t start.' });
    });
    p.postMessage({ type: 'start', taskId: task.id });
    const ping = setInterval(() => p.postMessage({ type: 'ping' }), PING_MS);
    const tick = setInterval(() => setNow(Date.now()), AD_TICK_MS);
    return () => {
      clearInterval(ping);
      clearInterval(tick);
      p.disconnect();
    };
  }, [task.id]);

  // The session reached its end time during the break.
  useEffect(() => {
    if (run && !session) finish({ kind: 'outlasted' });
  }, [run, session]);

  const completed = useMemo(
    () => completedThisWeek(tasks, outcomes, Date.now()).map((t) => ({ task: t, at: outcomes[t.id]!.at })),
    // Fixed for the length of the break.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run?.startedAt],
  );

  const spots = useMemo(() => {
    if (!run) return null;
    const short = run.durationMs < AD_BREAK_MS;
    const count = short ? DEV_AD_SPOT_COUNT : AD_SPOT_COUNT;
    return planAdBreak({
      totalMs: run.durationMs,
      count,
      breathingMs: short ? run.durationMs / count : BREATHING_SPOT_MS,
      hasTestimonial: completed.length > 0,
    });
  }, [run, completed.length]);

  const elapsed = run ? Math.max(0, now - run.startedAt) : 0;
  const left = run ? Math.max(0, run.durationMs - elapsed) : AD_BREAK_MS;

  // When the break has run, ask the background to end the session (retry once a second if it's early).
  useEffect(() => {
    if (!run || left > 0 || finished.current) return;
    if (now - sentComplete.current < 1000) return;
    sentComplete.current = now;
    port.current?.postMessage({ type: 'complete' });
  }, [run, left, now]);

  const current = spots ? spotAt(spots, elapsed) : null;

  useEffect(() => {
    document.title = current ? `Ad ${current.spot.index + 1} of ${spots!.length} · Block` : 'Ad break · Block';
  }, [current?.spot.index]);

  return (
    <div>
      <p className="text-center text-sm font-medium text-muted tabular-nums">
        {current ? (
          <>
            Ad {current.spot.index + 1} of {spots!.length} · Your break begins in {formatCountdown(left)}
          </>
        ) : (
          'Your break begins shortly…'
        )}
      </p>
      <p aria-live="polite" className="sr-only">
        {current ? `Ad ${current.spot.index + 1} of ${spots!.length}: ${SPOT_NAMES[current.spot.kind]}` : ''}
      </p>

      <section
        aria-label="Ad break"
        className="relative mt-4 overflow-hidden rounded-2xl border border-line bg-surface"
      >
        {current && <SpotProgress spot={current.spot} spotElapsedMs={current.spotElapsedMs} />}
        <span className="absolute top-4 left-4 rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-widest text-muted">
          AD
        </span>

        <div className="grid min-h-[26rem] place-items-center px-8 py-16">
          <AnimatePresence mode="wait">
            {current && (
              <motion.div
                key={current.spot.index}
                className="w-full"
                initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                animate={{ opacity: 1, y: 0, transition: transition.enter }}
                exit={{ opacity: 0, transition: transition.exit }}
              >
                <AdSpot
                  spot={current.spot}
                  spotElapsedMs={current.spotElapsedMs}
                  data={{ task, blockRemainingMs: session ? remainingMs(session, now) : 0, completed }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-end justify-between gap-4 px-5 pb-5">
          <p className="text-xs text-muted">Sponsored by Morning You</p>
          <p
            aria-disabled="true"
            className="max-w-56 rounded-lg border border-line bg-bg/80 px-3 py-2 text-right text-xs leading-snug text-muted"
          >
            Skip unavailable. You set this up for a reason.
          </p>
        </div>
      </section>
    </div>
  );
}
