/**
 * Pure focus-session logic, shared by the background worker and the pages.
 * No browser APIs here, so it can be unit-tested.
 */
import type { Task } from './tasks';
import { isAllowedHost } from './domains';
import { dateKey, timeOnDate } from './time';

export type SessionSource = 'scheduled' | 'manual';

/**
 * A running focus session. It refers to its task by id and lives in its own
 * storage key, so starting or ending a session never rewrites the task list.
 */
export interface ActiveSession {
  taskId: string;
  startedAt: number;
  endsAt: number;
  source: SessionSource;
}

export function taskStartMs(task: Task): number {
  return timeOnDate(task.date, task.start);
}

export function taskEndMs(task: Task): number {
  return timeOnDate(task.date, task.end);
}

export function isToday(task: Task, now: number): boolean {
  return task.date === dateKey(new Date(now));
}

/** The task whose time block contains `now`, if any. Tasks never overlap, so there's at most one. */
export function findDueTask(tasks: Task[], now: number): Task | undefined {
  return tasks.find((t) => isToday(t, now) && taskStartMs(t) <= now && now < taskEndMs(t));
}

/** A task can be started (early or on time) any time today before it ends. */
export function canStart(task: Task, now: number): boolean {
  return isToday(task, now) && now < taskEndMs(task);
}

export function remainingMs(session: ActiveSession, now: number): number {
  return Math.max(0, session.endsAt - now);
}

export function isExpired(session: ActiveSession, now: number): boolean {
  return now >= session.endsAt;
}

/** A session-lookup helper for UIs: the session, but only if it hasn't passed its end time. */
export function liveSession(session: ActiveSession | null, now: number): ActiveSession | null {
  return session && !isExpired(session, now) ? session : null;
}

export const BLOCK_RULE_ID = 1;

/**
 * One redirect rule: every top-level http(s) navigation goes to the Blocked page,
 * except to the allowed domains (subdomains included — that's how
 * `excludedRequestDomains` matches). The original URL rides along in the hash.
 */
export function buildBlockRule(allowedSites: string[], blockedPageUrl: string) {
  return {
    id: BLOCK_RULE_ID,
    priority: 1,
    action: {
      type: 'redirect' as const,
      redirect: { regexSubstitution: `${blockedPageUrl}#\\0` },
    },
    condition: {
      regexFilter: '^https?://.*',
      resourceTypes: ['main_frame' as const],
      ...(allowedSites.length ? { excludedRequestDomains: allowedSites } : {}),
    },
  };
}

/** Whether an already-open tab's URL should be sent to the Blocked page when a session starts. */
export function shouldSweepTab(url: string | undefined, allowedSites: string[]): boolean {
  if (!url || !/^https?:\/\//.test(url)) return false;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return !isAllowedHost(host, allowedSites);
}
