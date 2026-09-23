import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useFocus, useNow, usePassesLeft } from '@/lib/hooks';
import { remainingMs } from '@/lib/session';
import { PASSES_PER_WEEK } from '@/lib/override';
import { send } from '@/lib/messages';
import { formatRemaining, formatTime } from '@/lib/time';
import { duration, durationMs, easing, transition } from '@/lib/motion';
import { useTabLimitNotices } from '@/lib/useTabLimitNotices';
import { HoldButton } from '@/components/HoldButton';

const PLAN_URL = browser.runtime.getURL('/plan.html');

type Stage = { kind: 'decide' } | { kind: 'ended'; passesLeft: number } | { kind: 'error'; message: string };

/**
 * The override: the only way to end a session early. Step 5a: hold to confirm,
 * then spend an emergency pass. "Back to work" is always the easy choice.
 */
export default function App() {
  useTabLimitNotices();
  const reduce = useReducedMotion();
  const now = useNow();
  const { session, task, loaded } = useFocus(now);
  const passes = usePassesLeft(now);
  const [stage, setStage] = useState<Stage>({ kind: 'decide' });

  useEffect(() => {
    document.title = 'End session early · Block';
  }, []);

  const item: Variants = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: transition.enter } }
    : { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: transition.enter } };
  const container: Variants = {
    hidden: {},
    show: { transition: reduce ? {} : { staggerChildren: duration.instant } },
    exit: { opacity: 0, transition: transition.exit },
  };

  async function backToWork() {
    if (task) await send({ type: 'override/abandon', taskId: task.id, stage: 'hold' });
    // Back to the Blocked page (which lists the task's sites), or straight to the first allowed site.
    if (history.length > 1) history.back();
    else if (task?.allowedSites[0]) location.assign(`https://${task.allowedSites[0]}`);
  }

  async function spendPass() {
    if (!task) return;
    const res = await send({ type: 'override/pass', taskId: task.id });
    setStage(res.ok ? { kind: 'ended', passesLeft: res.passesLeft ?? 0 } : { kind: 'error', message: res.error });
  }

  const view =
    stage.kind === 'ended' ? 'ended' : !loaded || passes === null ? null : session && task ? 'decide' : 'none';

  return (
    <main className="min-h-screen bg-bg px-6 font-sans text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center py-20">
        <AnimatePresence mode="wait">
          {view === 'decide' && session && task && passes !== null && (
            <motion.div key="decide" variants={container} initial="hidden" animate="show" exit="exit">
              <motion.p variants={item} className="text-sm text-muted">
                End this session early?
              </motion.p>
              <motion.h1 variants={item} className="mt-3 text-3xl leading-tight font-semibold tracking-tight">
                {task.name}
              </motion.h1>
              {task.why && (
                <motion.p variants={item} className="mt-2 text-base text-muted">
                  {task.why}
                </motion.p>
              )}
              <motion.p variants={item} className="mt-4 text-base">
                <span className="font-medium tabular-nums">{formatRemaining(remainingMs(session, now))}</span>
                <span className="text-muted"> · until {formatTime(task.end)}</span>
              </motion.p>

              <motion.div variants={item} className="mt-10">
                <button
                  type="button"
                  onClick={backToWork}
                  className="w-full rounded-xl bg-accent px-5 py-3.5 text-base font-medium text-accent-ink transition-opacity hover:opacity-90"
                >
                  Back to work
                </button>
              </motion.div>

              <motion.section variants={item} aria-labelledby="passes-heading" className="mt-14">
                <h2 id="passes-heading" className="sr-only">
                  Emergency passes
                </h2>
                <PassTokens left={passes} />
                <p className="mt-3 text-sm text-muted">
                  {passes === 0
                    ? 'No emergency passes left this week. They reset Monday.'
                    : `${passes} emergency ${passes === 1 ? 'pass' : 'passes'} left this week · resets Monday`}
                </p>
                <div className="mt-5">
                  {passes > 0 ? (
                    <HoldButton holdingLabel="Keep holding…" onComplete={spendPass}>
                      Hold to use a pass
                    </HoldButton>
                  ) : (
                    <p className="text-sm text-muted">
                      {/* Step 5b replaces this with the confession. */}
                      Without a pass, this session runs until {formatTime(task.end)}.
                    </p>
                  )}
                </div>
              </motion.section>
            </motion.div>
          )}

          {view === 'ended' && stage.kind === 'ended' && (
            <motion.div key="ended" variants={container} initial="hidden" animate="show" exit="exit">
              <motion.h1 variants={item} className="text-3xl leading-tight font-semibold tracking-tight">
                Session ended.
              </motion.h1>
              <motion.div variants={item} className="mt-6">
                <SpendingTokens after={stage.passesLeft} />
              </motion.div>
              <motion.p variants={item} className="mt-3 text-base text-muted">
                {stage.passesLeft === 0
                  ? 'That was your last emergency pass this week. They reset Monday.'
                  : `${stage.passesLeft} emergency ${stage.passesLeft === 1 ? 'pass' : 'passes'} left this week.`}
              </motion.p>
              <motion.div variants={item} className="mt-10">
                <a
                  href={PLAN_URL}
                  className="inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90"
                >
                  Open plan
                </a>
              </motion.div>
            </motion.div>
          )}

          {view === 'none' && (
            <motion.div key="none" variants={container} initial="hidden" animate="show" exit="exit">
              <motion.h1 variants={item} className="text-3xl leading-tight font-semibold tracking-tight">
                No focus session is running.
              </motion.h1>
              <motion.p variants={item} className="mt-3 text-base text-muted">
                There’s nothing to end.
              </motion.p>
              <motion.div variants={item} className="mt-10">
                <a
                  href={PLAN_URL}
                  className="inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90"
                >
                  Open plan
                </a>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {stage.kind === 'error' && (
          <p role="alert" className="mt-6 text-sm text-notice">
            {stage.message}
          </p>
        )}
      </div>
    </main>
  );
}

/** Shows the tokens as they were, then lets the spent one leave, once the screen has settled. */
function SpendingTokens({ after }: { after: number }) {
  const [left, setLeft] = useState(after + 1);
  useEffect(() => {
    const t = setTimeout(() => setLeft(after), durationMs.emphasized * 2);
    return () => clearTimeout(t);
  }, [after]);
  return <PassTokens left={left} />;
}

/** Three tokens; spent ones leave quietly. */
function PassTokens({ left }: { left: number }) {
  const reduce = useReducedMotion();
  return (
    <ul aria-label={`${left} of ${PASSES_PER_WEEK} emergency passes left`} className="flex h-5 gap-2">
      <AnimatePresence initial={false}>
        {Array.from({ length: left }, (_, i) => (
          <motion.li
            key={i}
            aria-hidden="true"
            className="size-5 rounded-full border-2 border-accent bg-accent-soft"
            exit={{ opacity: 0, scale: reduce ? 1 : 0.6, transition: { duration: duration.standard, ease: easing.exit } }}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}
