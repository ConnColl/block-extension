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

/** Task ids that already have an outcome (e.g. ended early by override). They never start again. */
export type Finished = Record<string, unknown>;

/** The task whose time block contains `now`, if any. Tasks never overlap, so there's at most one. */
export function findDueTask(tasks: Task[], now: number, finished: Finished = {}): Task | undefined {
  return tasks.find((t) => !(t.id in finished) && isToday(t, now) && taskStartMs(t) <= now && now < taskEndMs(t));
}

/** A task can be started (early or on time) any time today before it ends, unless it's already finished. */
export function canStart(task: Task, now: number, finished: Finished = {}): boolean {
  return !(task.id in finished) && isToday(task, now) && now < taskEndMs(task);
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

/** How long before a scheduled session the "Focus begins in 1:00" heads-up appears. A policy constant, not a motion token. */
export const HEADS_UP_MS = 60_000;

/** The next scheduled task starting within the heads-up window (not the one already running). */
export function findUpcomingTask(tasks: Task[], now: number, runningTaskId?: string): Task | undefined {
  return tasks.find(
    (t) => t.id !== runningTaskId && isToday(t, now) && taskStartMs(t) > now && taskStartMs(t) - now <= HEADS_UP_MS,
  );
}

/** tabId → the URL the tab was on before it was parked on the Blocked page. */
export type ParkedTabs = Record<string, string>;

/**
 * At a session boundary, split parked tabs into those to restore and those to keep parked.
 * `nextAllowed` is the next session's allowlist (back-to-back tasks), or null if nothing follows.
 */
export function planRestore(parked: ParkedTabs, nextAllowed: string[] | null) {
  const restore: [number, string][] = [];
  const keep: ParkedTabs = {};
  for (const [id, url] of Object.entries(parked)) {
    if (nextAllowed && shouldSweepTab(url, nextAllowed)) keep[id] = url;
    else restore.push([Number(id), url]);
  }
  return { restore, keep };
}

/** "0:42" */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * How much of the session has passed, 0–1, in whole minutes so the progress
 * line moves once a minute rather than creeping every second.
 */
export function sessionProgress(session: ActiveSession, now: number): number {
  const total = Math.max(1, Math.round((session.endsAt - session.startedAt) / 60_000));
  const elapsed = Math.floor((now - session.startedAt) / 60_000);
  return Math.min(1, Math.max(0, elapsed / total));
}
