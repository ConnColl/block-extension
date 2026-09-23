import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ActiveSession, Task } from '@/lib/tasks';
import { doneSummary, nextTaskAfter, shiftedTo, trimmedEnd } from '@/lib/completion';
import type { TaskOutcome } from '@/lib/override';
import { send } from '@/lib/messages';
import { formatTime, toMinutes } from '@/lib/time';
import { transition } from '@/lib/motion';
import { CheckMark } from './CheckMark';

export type DoneResult = { kind: 'took-time-back'; earnedMinutes: number } | { kind: 'started-next'; name: string; end: string };

interface Props {
  session: ActiveSession;
  task: Task;
  tasks: Task[];
  outcomes: Record<string, TaskOutcome>;
  now: number;
  /** Tighter spacing for the popup. */
  compact?: boolean;
  onDone?: (result: DoneResult) => void;
}

type Step = 'idle' | 'confirm' | 'choose' | { result: DoneResult } | { error: string };

/**
 * Finishing early. No friction, just a light check, then a choice. Honor-based by
 * design: Block is a commitment device, not a lie detector.
 */
export function DoneFlow({ session, task, tasks, outcomes, now, compact, onDone }: Props) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>('idle');
  const [busy, setBusy] = useState(false);
  const { elapsedMin, totalMin, earnedMin } = doneSummary(session, now);
  const next = nextTaskAfter(tasks, task, outcomes);
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const nextPreview = next ? shiftedTo(next, toMinutes(trimmedEnd(task, nowMin))) : null;

  async function choose(then: 'start-next' | 'take-back') {
    if (busy) return;
    setBusy(true);
    const res = await send({ type: 'session/done', taskId: task.id, then });
    setBusy(false);
    if (!res.ok) return setStep({ error: res.error });
    const result: DoneResult = res.next
      ? { kind: 'started-next', name: res.next.name, end: res.next.end }
      : { kind: 'took-time-back', earnedMinutes: res.earnedMinutes ?? earnedMin };
    setStep({ result });
    onDone?.(result);
  }

  const enter = {
    initial: { opacity: 0, y: reduce ? 0 : 4 },
    animate: { opacity: 1, y: 0, transition: transition.enter },
    exit: { opacity: 0, transition: transition.exit },
  };
  const btn = 'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors';
  const primary = `${btn} bg-accent text-accent-ink hover:opacity-90`;
  const secondary = `${btn} border border-line hover:bg-surface`;
  const text = compact ? 'text-sm' : 'text-base';

  return (
    <div aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {step === 'idle' && (
          <motion.div key="idle" {...enter}>
            <button type="button" onClick={() => setStep('confirm')} className={secondary}>
              Done
            </button>
          </motion.div>
        )}

        {step === 'confirm' && (
          <motion.div key="confirm" {...enter}>
            <p className={text}>
              Done already? <span className="tabular-nums">{elapsedMin} of {totalMin} minutes.</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setStep('choose')} className={primary}>
                Yes, done.
              </button>
              <button type="button" onClick={() => setStep('idle')} className={secondary}>
                Not yet
              </button>
            </div>
          </motion.div>
        )}

        {step === 'choose' && (
          <motion.div key="choose" {...enter}>
            <div className="flex items-center gap-3">
              <CheckMark size={compact ? 28 : 36} />
              <p className={text}>Nicely done. What now?</p>
            </div>
            <div className={`mt-4 flex gap-2 ${compact ? 'flex-col' : 'flex-wrap'}`}>
              {next && nextPreview && (
                <button type="button" disabled={busy} onClick={() => choose('start-next')} className={`${primary} text-left`}>
                  Start next task now
                  <span className="block text-xs font-normal opacity-90">
                    {next.name} · until {formatTime(nextPreview.end)}
                  </span>
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => choose('take-back')}
                className={`${next ? secondary : primary} text-left`}
              >
                Take the time back
                <span className="block text-xs font-normal opacity-80">
                  {next ? `Free until ${formatTime(next.start)}` : `Free for ${earnedMin} minutes`}
                </span>
              </button>
            </div>
          </motion.div>
        )}

        {typeof step === 'object' && 'result' in step && (
          <motion.div key="result" {...enter}>
            <p className={`${text} font-medium`}>
              {step.result.kind === 'took-time-back'
                ? `You earned ${step.result.earnedMinutes} ${step.result.earnedMinutes === 1 ? 'minute' : 'minutes'}.`
                : `Now: ${step.result.name}, until ${formatTime(step.result.end)}.`}
            </p>
          </motion.div>
        )}

        {typeof step === 'object' && 'error' in step && (
          <motion.p key="error" role="alert" className="text-sm text-notice" {...enter}>
            {step.error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
