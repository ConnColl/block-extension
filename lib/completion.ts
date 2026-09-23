/**
 * Finishing tasks: early "Done", and "Did you finish?" at the end. Pure logic,
 * unit-tested. Done is honor-based by design: Block is a commitment device, not
 * a lie detector.
 */
import type { Task } from './tasks';
import type { ActiveSession, Finished } from './session';
import { fromMinutes, toMinutes } from './time';

const MINUTE = 60_000;
const LAST_MINUTE = 23 * 60 + 59;

/** "Done already? 16 of 60 minutes." and "You earned 44 minutes." */
export function doneSummary(session: ActiveSession, now: number) {
  const totalMin = Math.max(1, Math.round((session.endsAt - session.startedAt) / MINUTE));
  const elapsedMin = Math.min(totalMin, Math.max(0, Math.floor((now - session.startedAt) / MINUTE)));
  return { elapsedMin, totalMin, earnedMin: totalMin - elapsedMin };
}

/** The next task today after `current`, not already finished. Tasks never overlap, so it starts at or after `current` ends. */
export function nextTaskAfter(tasks: Task[], current: Task, finished: Finished = {}): Task | undefined {
  return tasks
    .filter((t) => t.id !== current.id && t.date === current.date && !(t.id in finished))
    .filter((t) => toMinutes(t.start) >= toMinutes(current.start))
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0];
}

/** Finishing early: the task really ended now. At least one minute long, never later than planned. */
export function trimmedEnd(task: Pick<Task, 'start' | 'end'>, nowMin: number): string {
  const s = toMinutes(task.start);
  return fromMinutes(Math.min(toMinutes(task.end), Math.max(s + 1, nowMin)));
}

/** "Start next task now": it moves to `startMin` and keeps its planned length (capped at 11:59 PM). */
export function shiftedTo(task: Pick<Task, 'start' | 'end'>, startMin: number): { start: string; end: string } {
  const length = toMinutes(task.end) - toMinutes(task.start);
  return { start: fromMinutes(startMin), end: fromMinutes(Math.min(startMin + length, LAST_MINUTE)) };
}
