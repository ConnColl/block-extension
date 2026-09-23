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
import { useFocus, useNow } from '@/lib/hooks';
import { send } from '@/lib/messages';
import { dateKey, formatRemaining, formatToday, fromMinutes, toMinutes } from '@/lib/time';
import { transition } from '@/lib/motion';
import { TaskForm } from '@/components/TaskForm';
import { TaskRow } from '@/components/TaskRow';
import { UndoNotice, type UndoState } from '@/components/UndoNotice';

/** Suggest the next free hour: after the last task, or the next half hour from now. */
function suggestDraft(tasks: Task[]): TaskDraft {
  const now = new Date();
  const nextHalfHour = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
  const lastEnd = tasks.reduce((max, t) => Math.max(max, toMinutes(t.end)), 0);
  const start = Math.max(lastEnd, nextHalfHour);
  return { name: '', why: '', start: fromMinutes(start), end: fromMinutes(start + 60), allowedSites: [] };
}

export default function App() {
  const reduce = useReducedMotion();
  const now = useNow();
  const { tasks: allTasks, session, loaded } = useFocus(now);
  const today = dateKey(new Date(now));
  const tasks = loaded && allTasks ? tasksOn(allTasks, today) : null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [notice, setNotice] = useState<UndoState | null>(null);
  const lastDeleted = useRef<Task | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);

  // A task that becomes locked while being edited leaves edit mode.
  useEffect(() => {
    if (editingId && isTaskLocked(editingId, session)) setEditingId(null);
  }, [editingId, session]);

  async function handleAdd(draft: TaskDraft) {
    const task = await addTask(draft);
    setSettlingId(task.id);
    setFormKey((k) => k + 1);
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
    setSettlingId(task.id);
    setNotice(null);
  }, []);

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

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      <main className="mx-auto max-w-2xl px-6 pt-16 pb-32">
        <header>
          <p className="text-sm text-muted">{formatToday()}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Morning plan</h1>
          <p className="mt-3 max-w-md text-base text-muted">
            Decide now what later-you can open. Each task gets a time and the few sites it actually needs.
          </p>
        </header>

        <section aria-labelledby="add-heading" className="mt-12 rounded-2xl border border-line bg-surface p-6">
          <h2 id="add-heading" className="mb-5 text-lg font-semibold tracking-tight">
            Add a task
          </h2>
          {tasks && (
            <TaskForm
              key={formKey}
              idPrefix={`new-${formKey}`}
              initial={suggestDraft(tasks)}
              others={tasks}
              submitLabel="Add task"
              onSubmit={handleAdd}
              autoFocus
            />
          )}
        </section>

        <section aria-labelledby="schedule-heading" className="mt-14">
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

          <ol className="relative mt-2 divide-y divide-line">
            <AnimatePresence initial={false} mode="popLayout">
              {tasks?.map((task) => (
                <motion.li
                  key={task.id}
                  layout={reduce ? false : 'position'}
                  initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: transition.exit }}
                  transition={reduce ? transition.standard : transition.spring}
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
                      remaining={
                        session && isTaskLocked(task.id, session) ? formatRemaining(remainingMs(session, now)) : undefined
                      }
                      startsIn={
                        taskStartMs(task) > now && taskStartMs(task) - now <= HEADS_UP_MS
                          ? formatCountdown(taskStartMs(task) - now)
                          : undefined
                      }
                      startable={!session && canStart(task, now)}
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
              ))}
            </AnimatePresence>
          </ol>
        </section>
      </main>

      <UndoNotice notice={notice} onUndo={handleUndo} onDismiss={handleDismiss} />
    </div>
  );
}
