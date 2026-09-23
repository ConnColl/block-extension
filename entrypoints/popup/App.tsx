import { useState } from 'react';
import { browser } from 'wxt/browser';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { tasksOn } from '@/lib/tasks';
import { HEADS_UP_MS, formatCountdown, remainingMs, taskStartMs } from '@/lib/session';
import { SiteIcon } from '@/components/SiteIcon';
import { useTabCounts } from '@/lib/useTabCounts';
import { TAB_LIMIT } from '@/lib/tabs';
import { copy } from '@/lib/copy';
import { DoneFlow, type DoneResult } from '@/components/DoneFlow';
import { FinishedQuestion } from '@/components/FinishedQuestion';
import { CheckMark } from '@/components/CheckMark';
import { useFocus, useNow, useOutcomes } from '@/lib/hooks';
import { dateKey, formatRemaining, formatTime } from '@/lib/time';
import { transition } from '@/lib/motion';

const PLAN_URL = browser.runtime.getURL('/plan.html');

/** Focus an existing plan tab if there is one; otherwise open a new one. */
async function openPlan() {
  try {
    const [existing] = await browser.runtime.getContexts({
      contextTypes: ['TAB'],
      documentUrls: [PLAN_URL],
    });
    if (existing && existing.tabId >= 0) {
      await browser.tabs.update(existing.tabId, { active: true });
      if (existing.windowId >= 0) await browser.windows.update(existing.windowId, { focused: true });
      window.close();
      return;
    }
  } catch {
    // getContexts unavailable — fall through to opening a new tab.
  }
  await browser.tabs.create({ url: PLAN_URL });
  window.close();
}

export default function App() {
  const reduce = useReducedMotion();
  const now = useNow();
  const { tasks, session, task, loaded } = useFocus(now);
  const tabs = useTabCounts();
  const outcomes = useOutcomes();
  const [doneResult, setDoneResult] = useState<DoneResult | null>(null);

  const today = tasks ? tasksOn(tasks, dateKey(new Date(now))) : [];
  const next = today.find((t) => taskStartMs(t) > now && !(t.id in outcomes));
  // The most recent task that ended on its own and hasn't been answered yet.
  const toAsk = [...today].reverse().find((t) => outcomes[t.id]?.pending);

  const enter = { opacity: 0, y: reduce ? 0 : 4 };

  return (
    <main className="w-80 bg-bg p-5 font-sans text-ink">
      <AnimatePresence initial={false}>
        {doneResult && (
          <motion.div
            key="done-result"
            className="mb-5 flex items-center gap-3 rounded-xl bg-surface p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: transition.enter }}
            exit={{ opacity: 0, transition: transition.exit }}
          >
            <CheckMark size={28} />
            <p className="text-sm font-medium">
              {doneResult.kind === 'took-time-back'
                ? `You earned ${doneResult.earnedMinutes} ${doneResult.earnedMinutes === 1 ? 'minute' : 'minutes'}.`
                : `Now: ${doneResult.name}, until ${formatTime(doneResult.end)}.`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        {!loaded ? null : session && task ? (
          <motion.section
            key="focus"
            aria-label="Focus session"
            initial={enter}
            animate={{ opacity: 1, y: 0, transition: transition.enter }}
            exit={{ opacity: 0, transition: transition.exit }}
          >
            <p className="text-sm font-medium text-accent tabular-nums">
              {copy.popupStatus(formatRemaining(remainingMs(session, now)))}
            </p>
            <h1 className="mt-2 text-lg leading-snug font-semibold tracking-tight">{task.name}</h1>
            {task.why && <p className="mt-1 text-sm text-muted">{task.why}</p>}
            <p className="mt-1 text-sm text-muted">Until {formatTime(task.end)}</p>
            {tabs && (
              <div className="mt-5">
                <p className="text-sm">
                  <span className="font-medium tabular-nums">
                    {tabs.inUse} of {TAB_LIMIT}
                  </span>{' '}
                  <span className="text-muted">tabs in use</span>
                </p>
                {tabs.paused > 0 && <p className="mt-1 text-sm text-muted">{copy.parked(tabs.paused)}</p>}
                <div aria-hidden="true" className="mt-2 flex gap-1">
                  {Array.from({ length: TAB_LIMIT }, (_, i) => (
                    <span
                      key={i}
                      className={`size-1.5 rounded-full ${i < tabs.inUse ? 'bg-accent' : 'bg-line'}`}
                    />
                  ))}
                </div>
              </div>
            )}
            {tasks && (
              <div className="mt-4">
                <DoneFlow
                  key={task.id}
                  compact
                  session={session}
                  task={task}
                  tasks={tasks}
                  outcomes={outcomes}
                  now={now}
                  onDone={setDoneResult}
                />
              </div>
            )}
            <h2 className="mt-5 text-xs font-medium text-muted">Open during this task</h2>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {task.allowedSites.map((site) => (
                <li key={site} className="flex items-center gap-1.5 rounded-full bg-accent-soft py-0.5 pr-2.5 pl-2 text-sm">
                  <SiteIcon domain={site} />
                  {site}
                </li>
              ))}
            </ul>
          </motion.section>
        ) : (
          <motion.section
            key="idle"
            aria-label="Today"
            initial={enter}
            animate={{ opacity: 1, y: 0, transition: transition.enter }}
            exit={{ opacity: 0, transition: transition.exit }}
          >
            <h1 className="text-sm font-semibold tracking-tight">Block</h1>
            {toAsk && (
              <div className="mt-3 rounded-xl bg-surface p-3">
                <FinishedQuestion key={toAsk.id} compact taskId={toAsk.id} taskName={toAsk.name} />
              </div>
            )}
            <p className="mt-3 text-sm text-muted">
              {next && taskStartMs(next) - now <= HEADS_UP_MS ? (
                <>
                  <span className="font-medium text-accent">
                    {copy.headsUpLead}
                    <span className="tabular-nums">{formatCountdown(taskStartMs(next) - now)}</span>
                  </span>{' '}
                  · {next.name}
                </>
              ) : next ? (
                <>
                  Next: <span className="font-medium text-ink">{next.name}</span> at {formatTime(next.start)}
                </>
              ) : today.length ? (
                'Nothing else planned for today.'
              ) : (
                'No tasks planned for today.'
              )}
            </p>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={openPlan}
        className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
      >
        Open plan
      </button>
    </main>
  );
}
