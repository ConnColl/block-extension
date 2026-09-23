import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  addTask,
  deleteTask,
  isTaskLocked,
  restoreTask,
  tasksOn,
  updateTask,
  type Task,
  type TaskDraft,
} from '@/lib/tasks';
import { HEADS_UP_MS, canStart, formatCountdown, remainingMs, taskStartMs } from '@/lib/session';
import { useFocus, useNow, useOutcomes } from '@/lib/hooks';
import { send } from '@/lib/messages';
import { dateKey, formatRemaining, formatTime, formatToday, fromMinutes } from '@/lib/time';
import { duration, easing, transition } from '@/lib/motion';
import { partitionSchedule, progressThrough, suggestSlot } from '@/lib/schedule';
import { TaskForm } from '@/components/TaskForm';
import { TaskRow } from '@/components/TaskRow';
import { UndoNotice, type UndoState } from '@/components/UndoNotice';
import { DevSettings } from '@/components/DevSettings';
import { useTabLimitNotices } from '@/lib/useTabLimitNotices';

const minutesOfDay = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

/** Signature moment 1: a new task settles into its place; the others shift to make room, on the same timing. */
const settle = { duration: duration.standard, ease: easing.enter };

export default function App() {
  useTabLimitNotices();
  const reduce = useReducedMotion();
  const now = useNow();
  const { tasks: allTasks, session, loaded } = useFocus(now);
  const outcomes = useOutcomes();
  const today = dateKey(new Date(now));
  const tasks = loaded && allTasks ? tasksOn(allTasks, today) : null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState<UndoState | null>(null);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const lastDeleted = useRef<Task | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);

  // A task that becomes locked while being edited leaves edit mode.
  useEffect(() => {
    if (editingId && isTaskLocked(editingId, session)) setEditingId(null);
  }, [editingId, session]);

  const nowMin = minutesOfDay(now);
  const schedule = tasks ? partitionSchedule(tasks, nowMin, outcomes) : null;

  /** Make a just-added (or restored) task visible: open "Earlier today" if it landed there, and scroll to it. */
  function reveal(task: Task) {
    setSettlingId(task.id);
    if (partitionSchedule([task], minutesOfDay(Date.now()), outcomes).earlier.length) setEarlierOpen(true);
    requestAnimationFrame(() =>
      document
        .getElementById(`task-${task.id}`)
        ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }),
    );
  }

  async function handleAdd(draft: TaskDraft) {
    const task = await addTask(draft);
    setFormKey((k) => k + 1);
    reveal(task);
  }

  async function handleUpdate(id: string, draft: TaskDraft) {
    await updateTask(id, draft);
    finishEditing(id);
  }

  function finishEditing(id: string) {
    setEditingId(null);
    requestAnimationFrame(() => document.getElementById(`edit-${id}`)?.focus());
  }

  async function handleDelete(task: Task) {
    try {
      await deleteTask(task.id);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Couldn’t delete this task.', false);
      return;
    }
    if (editingId === task.id) setEditingId(null);
    lastDeleted.current = task;
    showNotice(`Deleted “${task.name}”.`, true);
    // Keep keyboard focus somewhere sensible now that the row is gone.
    listHeading.current?.focus();
  }

  const handleUndo = useCallback(async () => {
    const task = lastDeleted.current;
    if (!task) return;
    lastDeleted.current = null;
    const clash = await restoreTask(task);
    if (clash) {
      showNotice(`Couldn’t restore “${task.name}”: “${clash.name}” now uses that time.`, false);
      return;
    }
    reveal(task);
    setNotice(null);
  }, [outcomes, reduce]);

  async function handleStart(task: Task) {
    const res = await send({ type: 'session/start', taskId: task.id });
    if (!res.ok) showNotice(res.error, false);
  }

  const handleDismiss = useCallback(() => {
    lastDeleted.current = null;
    setNotice(null);
  }, []);

  function showNotice(message: string, canUndo: boolean) {
    setNotice({ key: Date.now(), message, canUndo });
  }

  function renderTask(task: Task, nowFraction?: number) {
    if (!tasks) return null;
    return (
      <motion.li
        key={task.id}
        id={`task-${task.id}`}
        layout={reduce ? false : 'position'}
        initial={{ opacity: 0, y: reduce ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: transition.exit }}
        transition={reduce ? transition.standard : settle}
        className="scroll-mt-8"
      >
        {editingId === task.id ? (
          <div className="py-6">
            <TaskForm
              idPrefix={`edit-form-${task.id}`}
              initial={task}
              others={tasks.filter((t) => t.id !== task.id)}
              submitLabel="Save changes"
              onSubmit={(draft) => handleUpdate(task.id, draft)}
              onCancel={() => finishEditing(task.id)}
              autoFocus
            />
          </div>
        ) : (
          <TaskRow
            task={task}
            locked={isTaskLocked(task.id, session)}
            remaining={session && isTaskLocked(task.id, session) ? formatRemaining(remainingMs(session, now)) : undefined}
            startsIn={
              taskStartMs(task) > now && taskStartMs(task) - now <= HEADS_UP_MS
                ? formatCountdown(taskStartMs(task) - now)
                : undefined
            }
            startable={!session && canStart(task, now, outcomes)}
            endedEarly={outcomes[task.id]?.outcome === 'overridden'}
            completed={outcomes[task.id]?.outcome === 'completed'}
            nowFraction={nowFraction}
            onStart={() => handleStart(task)}
            settling={settlingId === task.id}
            onEdit={() => {
              setSettlingId(null);
              setEditingId(task.id);
            }}
            onDelete={() => handleDelete(task)}
          />
        )}
      </motion.li>
    );
  }

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      <main className="mx-auto max-w-6xl px-6 pt-12 pb-32">
        <header>
          <p className="text-sm text-muted">{formatToday()}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Morning plan</h1>
          <p className="mt-2 max-w-xl text-base text-muted">
            Decide now what later-you can open. Each task gets a time and the few sites it actually needs.
          </p>
        </header>

        {/* Wide: form left, schedule right, both from the top. Narrow: one column, form first. */}
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <section aria-labelledby="add-heading" className="self-start rounded-2xl border border-line bg-surface p-6">
            <h2 id="add-heading" className="mb-5 text-lg font-semibold tracking-tight">
              Add a task
            </h2>
            {tasks && (
              <TaskForm
                key={formKey}
                idPrefix={`new-${formKey}`}
                initial={{ name: '', why: '', allowedSites: [], ...suggestSlot(tasks, nowMin) }}
                others={tasks}
                submitLabel="Add task"
                onSubmit={handleAdd}
                followInitialTimes
                autoFocus
              />
            )}
          </section>

          <section aria-labelledby="schedule-heading">
            <h2
              id="schedule-heading"
              ref={listHeading}
              tabIndex={-1}
              className="text-lg font-semibold tracking-tight"
            >
              Today
            </h2>

            {tasks && tasks.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={transition.standard}
                className="mt-4 text-base text-muted"
              >
                Nothing planned yet. Add the first thing you want to focus on.
              </motion.p>
            )}

            {schedule && tasks && tasks.length > 0 && (
              <>
                {/* "Now" line: above what's next, unless a task is in progress (then it's a dot on that task). */}
                {!schedule.current && (
                  <p aria-hidden="true" className="mt-4 flex items-center gap-3 text-xs font-medium text-accent">
                    <span className="tabular-nums">Now · {formatTime(fromMinutes(nowMin))}</span>
                    <span className="h-px flex-1 bg-accent/40" />
                  </p>
                )}

                <ol aria-label="Current and upcoming tasks" className="relative mt-2 divide-y divide-line">
                  <AnimatePresence initial={false} mode="popLayout">
                    {[...(schedule.current ? [schedule.current] : []), ...schedule.upcoming].map((task) =>
                      renderTask(task, task === schedule.current ? progressThrough(task, nowMin) : undefined),
                    )}
                  </AnimatePresence>
                </ol>
                {!schedule.current && schedule.upcoming.length === 0 && (
                  <p className="mt-3 text-sm text-muted">Nothing else planned for today.</p>
                )}

                {schedule.earlier.length > 0 && (
                  <div className="mt-8">
                    <button
                      type="button"
                      aria-expanded={earlierOpen}
                      aria-controls="earlier-list"
                      onClick={() => setEarlierOpen((o) => !o)}
                      className="flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
                    >
                      <motion.span
                        aria-hidden="true"
                        className="inline-block"
                        animate={{ rotate: earlierOpen ? 90 : 0 }}
                        transition={transition.quick}
                      >
                        ›
                      </motion.span>
                      Earlier today ({schedule.earlier.length})
                    </button>
                    <AnimatePresence initial={false}>
                      {earlierOpen && (
                        <motion.div
                          key="earlier"
                          id="earlier-list"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1, transition: settle }}
                          exit={{ height: 0, opacity: 0, transition: transition.exit }}
                          className="overflow-hidden"
                        >
                          <ol aria-label="Earlier today" className="relative mt-2 divide-y divide-line opacity-80">
                            <AnimatePresence initial={false} mode="popLayout">
                              {schedule.earlier.map((task) => renderTask(task))}
                            </AnimatePresence>
                          </ol>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <DevSettings now={now} />
      </main>

      <UndoNotice notice={notice} onUndo={handleUndo} onDismiss={handleDismiss} />
    </div>
  );
}
