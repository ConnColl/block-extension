import { storage } from 'wxt/utils/storage';
import type { ActiveSession } from './session';
import { dateKey, toMinutes } from './time';

export type { ActiveSession } from './session';
export { toMinutes } from './time';

export interface Task {
  id: string;
  /** Local calendar day this task belongs to, "YYYY-MM-DD". */
  date: string;
  name: string;
  /** Optional one line: what this task is for. */
  why?: string;
  /** "HH:MM", 24-hour, local time. */
  start: string;
  /** "HH:MM", 24-hour, local time. Always after `start` (no crossing midnight). */
  end: string;
  /** Normalized domains, e.g. "notion.so". Subdomains are allowed implicitly. */
  allowedSites: string[];
  createdAt: number;
  /** Created by the developer "Fill sample data" setting. Always labeled as sample in the UI. */
  sample?: boolean;
}

export const tasksItem = storage.defineItem<Task[]>('local:tasks', {
  fallback: [],
  version: 2,
  migrations: {
    // v1 tasks had no date. They were all planned as "today", so they become today's.
    2: (tasks: Omit<Task, 'date'>[]) => tasks.map((t) => ({ ...t, date: dateKey() })),
  },
});

export const activeSessionItem = storage.defineItem<ActiveSession | null>('local:activeSession', {
  fallback: null,
});

/** How long the "Task deleted — Undo" notice stays up. Not a motion token: it's a reading window. */
export const UNDO_WINDOW_MS = 5000;

/** Max length of the one-line "why". */
export const WHY_MAX_LENGTH = 120;

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

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.date.localeCompare(b.date) || toMinutes(a.start) - toMinutes(b.start));
}

export function tasksOn(tasks: Task[], date: string): Task[] {
  return tasks.filter((t) => t.date === date);
}

export type TaskDraft = Pick<Task, 'name' | 'start' | 'end' | 'allowedSites' | 'why'>;
export type DraftErrors = Partial<Record<'name' | 'time' | 'sites', string>>;

/** `others` should be the other tasks on the same day. */
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

function clean(draft: TaskDraft): TaskDraft {
  const why = draft.why?.trim().slice(0, WHY_MAX_LENGTH);
  return { ...draft, name: draft.name.trim(), why: why || undefined };
}

/** Adds a task to today's plan. */
export async function addTask(draft: TaskDraft): Promise<Task> {
  const task: Task = {
    ...clean(draft),
    id: crypto.randomUUID(),
    date: dateKey(),
    createdAt: Date.now(),
  };
  const tasks = await tasksItem.getValue();
  const clash = findOverlap(task, tasksOn(tasks, task.date));
  if (clash) throw new TaskOverlapError(clash);
  await tasksItem.setValue(sortTasks([...tasks, task]));
  return task;
}

export async function updateTask(id: string, draft: TaskDraft): Promise<void> {
  await assertUnlocked(id);
  const tasks = await tasksItem.getValue();
  const current = tasks.find((t) => t.id === id);
  if (!current) return;
  const clash = findOverlap(draft, tasksOn(tasks, current.date).filter((t) => t.id !== id));
  if (clash) throw new TaskOverlapError(clash);
  await tasksItem.setValue(sortTasks(tasks.map((t) => (t.id === id ? { ...t, ...clean(draft) } : t))));
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
  const clash = findOverlap(task, tasksOn(tasks, task.date));
  if (clash) return clash;
  await tasksItem.setValue(sortTasks([...tasks, task]));
  return undefined;
}

/** The scheduled session starting within the next minute, for the heads-up notice. Written only by the background. */
export interface UpcomingSession {
  taskId: string;
  taskName: string;
  startsAt: number;
}

export const upcomingItem = storage.defineItem<UpcomingSession | null>('local:upcoming', { fallback: null });
