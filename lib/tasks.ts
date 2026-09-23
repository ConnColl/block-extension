import { storage } from 'wxt/utils/storage';

export interface Task {
  id: string;
  name: string;
  /** "HH:MM", 24-hour, local time. */
  start: string;
  /** "HH:MM", 24-hour, local time. Always after `start` (no crossing midnight). */
  end: string;
  /** Normalized domains, e.g. "notion.so". Subdomains are allowed implicitly. */
  allowedSites: string[];
  createdAt: number;
}

/**
 * A running focus session. Sessions reference tasks by id and live in their own
 * storage key, so a task never has to be rewritten when a session starts or ends.
 * Step 1 never writes this; it exists so the edit/delete lock has one source of truth.
 */
export interface ActiveSession {
  taskId: string;
  startedAt: number;
  endsAt: number;
}

export const tasksItem = storage.defineItem<Task[]>('local:tasks', { fallback: [] });
export const activeSessionItem = storage.defineItem<ActiveSession | null>('local:activeSession', {
  fallback: null,
});

/** How long the "Task deleted — Undo" notice stays up. Not a motion token: it's a reading window. */
export const UNDO_WINDOW_MS = 5000;

export class TaskLockedError extends Error {
  constructor() {
    super('This task is in an active focus session. End it with an override to make changes.');
  }
}

export class TaskOverlapError extends Error {
  constructor(public clash: Task) {
    super(`This overlaps with “${clash.name}” (${clash.start}–${clash.end}).`);
  }
}

export function isTaskLocked(taskId: string, session: ActiveSession | null): boolean {
  return session?.taskId === taskId;
}

/** Every mutation of an existing task goes through this guard. */
async function assertUnlocked(taskId: string) {
  if (isTaskLocked(taskId, await activeSessionItem.getValue())) throw new TaskLockedError();
}

export function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

export type TaskDraft = Pick<Task, 'name' | 'start' | 'end' | 'allowedSites'>;
export type DraftErrors = Partial<Record<'name' | 'time' | 'sites', string>>;

export function validateDraft(draft: TaskDraft, others: Task[]): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.name.trim()) errors.name = 'Give this task a name.';

  if (!draft.start || !draft.end) {
    errors.time = 'Choose a start and end time.';
  } else if (toMinutes(draft.end) <= toMinutes(draft.start)) {
    errors.time = 'End time needs to be after the start time.';
  } else {
    const clash = findOverlap(draft, others);
    if (clash) errors.time = `This overlaps with “${clash.name}” (${clash.start}–${clash.end}).`;
  }

  if (draft.allowedSites.length === 0) errors.sites = 'Add at least one site this task needs.';
  return errors;
}

export function findOverlap(slot: Pick<Task, 'start' | 'end'>, others: Task[]): Task | undefined {
  const s = toMinutes(slot.start);
  const e = toMinutes(slot.end);
  return others.find((t) => s < toMinutes(t.end) && toMinutes(t.start) < e);
}

export async function addTask(draft: TaskDraft): Promise<Task> {
  const task: Task = {
    ...draft,
    name: draft.name.trim(),
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const tasks = await tasksItem.getValue();
  const clash = findOverlap(task, tasks);
  if (clash) throw new TaskOverlapError(clash);
  await tasksItem.setValue(sortTasks([...tasks, task]));
  return task;
}

export async function updateTask(id: string, draft: TaskDraft): Promise<void> {
  await assertUnlocked(id);
  const tasks = await tasksItem.getValue();
  const clash = findOverlap(draft, tasks.filter((t) => t.id !== id));
  if (clash) throw new TaskOverlapError(clash);
  await tasksItem.setValue(
    sortTasks(tasks.map((t) => (t.id === id ? { ...t, ...draft, name: draft.name.trim() } : t))),
  );
}

export async function deleteTask(id: string): Promise<Task | undefined> {
  await assertUnlocked(id);
  const tasks = await tasksItem.getValue();
  const removed = tasks.find((t) => t.id === id);
  await tasksItem.setValue(tasks.filter((t) => t.id !== id));
  return removed;
}

/**
 * Put a just-deleted task back. Fails (returns the clashing task) if a task
 * added in the meantime now occupies that time.
 */
export async function restoreTask(task: Task): Promise<Task | undefined> {
  const tasks = await tasksItem.getValue();
  if (tasks.some((t) => t.id === task.id)) return undefined;
  const clash = findOverlap(task, tasks);
  if (clash) return clash;
  await tasksItem.setValue(sortTasks([...tasks, task]));
  return undefined;
}
