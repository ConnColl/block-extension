import { useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ActiveSession, Task } from '@/lib/tasks';
import type { TaskOutcome } from '@/lib/override';
import { AD_BREAK_MS, AD_PORT, completedThisWeek } from '@/lib/adbreak';
import { formatCountdown, remainingMs } from '@/lib/session';
import { transition } from '@/lib/motion';
import { AdSpot } from './AdSpots';
import { VideoAd } from './VideoAd';

/** The ad break's own clock ticks faster than the page clock so the countdown stays crisp. */
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
 * Step 5c: the 10-minute unskippable ad break. Sponsored only by Morning You.
 * The background times it, so leaving the page resets it and the session only
 * ends once it has really run.
 *
 * For now the whole break is one looping video (a demo placeholder), falling
 * back to The Pitch if the video can't load. The spot lineup in AdSpots is the
 * next iteration and is kept, unused, for then.
 */
export function AdBreak({ task, session, tasks, outcomes, onFinish }: Props) {
  const reduce = useReducedMotion();
  const [run, setRun] = useState<{ startedAt: number; durationMs: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [videoFailed, setVideoFailed] = useState<string | null>(null);
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

  const elapsed = run ? Math.max(0, now - run.startedAt) : 0;
  const left = run ? Math.max(0, run.durationMs - elapsed) : AD_BREAK_MS;

  // When the break has run, ask the background to end the session (retry once a second if it's early).
  useEffect(() => {
    if (!run || left > 0 || finished.current) return;
    if (now - sentComplete.current < 1000) return;
    sentComplete.current = now;
    port.current?.postMessage({ type: 'complete' });
  }, [run, left, now]);

  useEffect(() => {
    document.title = 'Ad break · Block';
  }, []);

  return (
    <div>
      <p className="text-center text-sm font-medium text-muted tabular-nums">
        {run ? <>Ad break · Your break begins in {formatCountdown(left)}</> : 'Your break begins shortly…'}
      </p>

      <section
        aria-label="Ad break"
        className="relative mt-4 overflow-hidden rounded-2xl border border-line bg-surface"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-widest text-muted">
            AD
          </span>
        </div>

        <div className="px-5 pt-4 pb-6">
          <AnimatePresence mode="wait" initial={false}>
            {!videoFailed ? (
              <motion.div key="video" exit={{ opacity: 0, transition: transition.exit }}>
                <VideoAd startPaused={!!reduce} onFail={setVideoFailed} />
              </motion.div>
            ) : (
              <motion.div
                key="pitch"
                className="grid min-h-[20rem] place-items-center"
                initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                animate={{ opacity: 1, y: 0, transition: transition.enter }}
              >
                <AdSpot
                  spot={{ kind: 'pitch', index: 0, startMs: 0, durationMs: run?.durationMs ?? AD_BREAK_MS, variant: 0 }}
                  spotElapsedMs={elapsed}
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
