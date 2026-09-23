/** Pure schedule helpers for the Morning Plan. No browser APIs. */
import type { Task } from './tasks';
import type { Finished } from './session';
import { fromMinutes, toMinutes } from './time';

const LAST_MINUTE = 23 * 60 + 59;
const DEFAULT_LENGTH_MIN = 60;
const ROUND_TO_MIN = 5;

/**
 * Default time for a new task: now, rounded up to the next 5 minutes, moved past
 * any task already occupying that time; one hour long, but never running into the
 * next task or past 11:59 PM. `now` is minutes since local midnight.
 */
export function suggestSlot(tasks: Pick<Task, 'start' | 'end'>[], nowMin: number): { start: string; end: string } {
  let start = Math.ceil(nowMin / ROUND_TO_MIN) * ROUND_TO_MIN;
  const sorted = [...tasks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (const t of sorted) {
    if (toMinutes(t.start) <= start && start < toMinutes(t.end)) start = toMinutes(t.end);
  }
  start = Math.min(start, LAST_MINUTE);
  const nextStart = sorted.map((t) => toMinutes(t.start)).find((s) => s > start) ?? Infinity;
  const end = Math.min(start + DEFAULT_LENGTH_MIN, nextStart, LAST_MINUTE);
  return { start: fromMinutes(start), end: fromMinutes(end) };
}

/**
 * Split today's tasks for display: the one in progress, the upcoming ones, and the
 * earlier ones (time passed, or already finished, e.g. ended early by override).
 */
export function partitionSchedule(tasks: Task[], nowMin: number, finished: Finished = {}) {
  let current: Task | undefined;
  const upcoming: Task[] = [];
  const earlier: Task[] = [];
  for (const t of [...tasks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))) {
    const s = toMinutes(t.start);
    const e = toMinutes(t.end);
    if (t.id in finished || e <= nowMin) earlier.push(t);
    else if (s <= nowMin) current = t;
    else upcoming.push(t);
  }
  return { current, upcoming, earlier };
}

/** How far through a task `now` is, 0–1, for the "now" dot on its time bar. */
export function progressThrough(task: Pick<Task, 'start' | 'end'>, nowMin: number): number {
  const s = toMinutes(task.start);
  const e = toMinutes(task.end);
  return Math.min(1, Math.max(0, (nowMin - s) / Math.max(1, e - s)));
}
