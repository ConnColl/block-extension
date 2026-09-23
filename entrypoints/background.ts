import { browser, type Browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { defineBackground } from 'wxt/utils/define-background';
import { activeSessionItem, tasksItem, upcomingItem, type Task } from '@/lib/tasks';
import {
  BLOCK_RULE_ID,
  HEADS_UP_MS,
  buildBlockRule,
  canStart,
  findDueTask,
  findUpcomingTask,
  isExpired,
  isToday,
  liveSession,
  planRestore,
  shouldSweepTab,
  taskEndMs,
  taskStartMs,
  type ActiveSession,
  type ParkedTabs,
  type SessionSource,
} from '@/lib/session';
import type { Request, Response } from '@/lib/messages';

const START_ALARM_PREFIX = 'start:';
const HEADS_UP_ALARM_PREFIX = 'heads-up:';
const END_ALARM = 'session-end';
const BLOCKED_PAGE = browser.runtime.getURL('/blocked.html');

// Tab and window ids only mean something while Chrome is running, so these live in session storage.
const parkedTabsItem = storage.defineItem<ParkedTabs>('session:parkedTabs', { fallback: {} });
const windowStateItem = storage.defineItem<{ windowId: number; state: `${Browser.windows.WindowState}` } | null>(
  'session:windowBeforeFocus',
  { fallback: null },
);

/**
 * Run session changes one at a time, so an alarm and a "Start now" click can't
 * both start a session.
 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

const blockedUrlFor = (url: string) => `${BLOCKED_PAGE}#${url}`;

/** Make the redirect rule match the session: present while one runs, absent otherwise. */
async function syncBlockRule(task: Task | null) {
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [BLOCK_RULE_ID],
    addRules: task ? [buildBlockRule(task.allowedSites, BLOCKED_PAGE)] : [],
  });
}

/** Send parked tabs back to where they were — only if they're still sitting on the Blocked page. */
async function restoreTabs(entries: [number, string][]) {
  await Promise.all(
    entries.map(async ([tabId, url]) => {
      try {
        const tab = await browser.tabs.get(tabId);
        if (tab.url?.startsWith(BLOCKED_PAGE)) await browser.tabs.update(tabId, { url });
      } catch {
        // Tab was closed.
      }
    }),
  );
}

async function enterFullscreen() {
  try {
    const win = await browser.windows.getLastFocused({ windowTypes: ['normal'] });
    if (win.id === undefined || win.state === 'fullscreen') return;
    // On a back-to-back handover, keep the state from before the first session.
    if (!(await windowStateItem.getValue())) {
      await windowStateItem.setValue({ windowId: win.id, state: win.state ?? 'normal' });
    }
    await browser.windows.update(win.id, { state: 'fullscreen' });
  } catch {
    // No normal window (e.g. all closed) — nothing to do.
  }
}

async function exitFullscreen() {
  const saved = await windowStateItem.getValue();
  if (!saved) return;
  await windowStateItem.setValue(null);
  try {
    const win = await browser.windows.get(saved.windowId);
    // If the user already left full screen, leave their window alone.
    if (win.state === 'fullscreen') await browser.windows.update(saved.windowId, { state: saved.state });
  } catch {
    // Window was closed.
  }
}

async function startSession(task: Task, source: SessionSource) {
  const session: ActiveSession = { taskId: task.id, startedAt: Date.now(), endsAt: taskEndMs(task), source };
  await syncBlockRule(task);
  await activeSessionItem.setValue(session);
  await browser.alarms.create(END_ALARM, { when: session.endsAt });

  // Back-to-back: tabs parked by the previous task come back if this task allows them.
  const { restore, keep } = planRestore(await parkedTabsItem.getValue(), task.allowedSites);
  await restoreTabs(restore);

  // The rule only catches new navigations; park tabs already open on other sites.
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (tab.id === undefined || !shouldSweepTab(tab.url, task.allowedSites)) continue;
    keep[tab.id] = tab.url!;
    await browser.tabs.update(tab.id, { url: blockedUrlFor(tab.url!) }).catch(() => {});
  }
  await parkedTabsItem.setValue(keep);

  await enterFullscreen();
}

/** End the session. If another task is due right now (back-to-back), hand straight over to it. */
async function endSession(tasks: Task[], now: number) {
  const next = findDueTask(tasks, now);
  if (next) {
    await startSession(next, 'scheduled');
    return;
  }
  await activeSessionItem.setValue(null);
  await syncBlockRule(null);
  await browser.alarms.clear(END_ALARM);
  const { restore } = planRestore(await parkedTabsItem.getValue(), null);
  await parkedTabsItem.setValue({});
  await restoreTabs(restore);
  await exitFullscreen();
}

/**
 * Bring storage, the block rule, alarms and the heads-up into agreement.
 * With `catchUp`, a task whose block is running right now starts (used when
 * Chrome starts or the extension is installed/reloaded, i.e. we may have missed its start).
 */
async function reconcile({ catchUp }: { catchUp: boolean }) {
  const now = Date.now();
  const tasks = await tasksItem.getValue();
  let session = await activeSessionItem.getValue();
  const sessionTask = session ? tasks.find((t) => t.id === session!.taskId) : undefined;

  if (session && (isExpired(session, now) || !sessionTask)) {
    await endSession(tasks, now);
    session = await activeSessionItem.getValue();
  } else if (session && sessionTask) {
    // Re-assert in case the rule or alarm was lost (e.g. extension reloaded mid-session).
    await syncBlockRule(sessionTask);
    await browser.alarms.create(END_ALARM, { when: session.endsAt });
  } else {
    await syncBlockRule(null);
    const due = catchUp ? findDueTask(tasks, now) : undefined;
    if (due) await startSession(due, 'scheduled');
    session = await activeSessionItem.getValue();
  }

  await scheduleAlarms(tasks, now);
  await syncUpcoming(tasks, now, session?.taskId);
}

/** One start alarm and one heads-up alarm per task that starts later today. */
async function scheduleAlarms(tasks: Task[], now: number) {
  const alarms = await browser.alarms.getAll();
  await Promise.all(
    alarms
      .filter((a) => a.name.startsWith(START_ALARM_PREFIX) || a.name.startsWith(HEADS_UP_ALARM_PREFIX))
      .map((a) => browser.alarms.clear(a.name)),
  );
  for (const t of tasks) {
    const start = taskStartMs(t);
    if (!isToday(t, now) || start <= now) continue;
    await browser.alarms.create(`${START_ALARM_PREFIX}${t.id}`, { when: start });
    if (start - HEADS_UP_MS > now) {
      await browser.alarms.create(`${HEADS_UP_ALARM_PREFIX}${t.id}`, { when: start - HEADS_UP_MS });
    }
  }
}

/** Show "Focus begins in 1:00" for the next scheduled task starting within a minute; clear it otherwise. */
async function syncUpcoming(tasks: Task[], now: number, runningTaskId?: string) {
  const soon = findUpcomingTask(tasks, now, runningTaskId);
  const current = await upcomingItem.getValue();
  const next = soon ? { taskId: soon.id, taskName: soon.name, startsAt: taskStartMs(soon) } : null;
  if (JSON.stringify(current) !== JSON.stringify(next)) await upcomingItem.setValue(next);
}

async function onStartAlarm(taskId: string) {
  await reconcile({ catchUp: false }); // ends a previous session (and hands over) if its end alarm hasn't fired yet
  if (!(await activeSessionItem.getValue())) {
    const task = (await tasksItem.getValue()).find((t) => t.id === taskId);
    if (task && canStart(task, Date.now())) await startSession(task, 'scheduled');
  }
  await syncUpcoming(await tasksItem.getValue(), Date.now(), (await activeSessionItem.getValue())?.taskId);
}

async function startManually(taskId: string): Promise<Response> {
  await reconcile({ catchUp: false });
  if (await activeSessionItem.getValue()) {
    return { ok: false, error: 'A focus session is already running.' };
  }
  const tasks = await tasksItem.getValue();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: 'That task no longer exists.' };
  if (!canStart(task, Date.now())) return { ok: false, error: 'This task’s time has already passed.' };
  await startSession(task, 'manual');
  await syncUpcoming(tasks, Date.now(), task.id);
  return { ok: true };
}

/**
 * Second blocking layer. The redirect rule never sees pages that load without a
 * network request: service-worker-served pages (e.g. a signed-in Pinterest),
 * back/forward cache restores, and prerendered pages. Catch those by URL.
 */
async function checkTab(tabId: number, url: string | undefined) {
  if (!url || !/^https?:\/\//.test(url)) return;
  const session = liveSession(await activeSessionItem.getValue(), Date.now());
  if (!session) return;
  const task = (await tasksItem.getValue()).find((t) => t.id === session.taskId);
  if (task && shouldSweepTab(url, task.allowedSites)) {
    await browser.tabs.update(tabId, { url: blockedUrlFor(url) }).catch(() => {});
  }
}

async function forgetParkedTab(tabId: number) {
  const parked = await parkedTabsItem.getValue();
  if (!(tabId in parked)) return;
  const { [tabId]: _removed, ...rest } = parked;
  await parkedTabsItem.setValue(rest);
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => void serial(() => reconcile({ catchUp: true })));
  browser.runtime.onStartup.addListener(() => void serial(() => reconcile({ catchUp: true })));

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith(START_ALARM_PREFIX)) {
      void serial(() => onStartAlarm(alarm.name.slice(START_ALARM_PREFIX.length)));
    } else {
      // END_ALARM and heads-up alarms: reconcile ends sessions and shows the heads-up.
      void serial(() => reconcile({ catchUp: false }));
    }
  });

  // Task edits reschedule alarms and the heads-up.
  tasksItem.watch(() => void serial(() => reconcile({ catchUp: false })));

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) void checkTab(tabId, changeInfo.url);
  });
  browser.tabs.onReplaced.addListener((addedTabId) => {
    void browser.tabs.get(addedTabId).then((tab) => checkTab(addedTabId, tab.url), () => {});
  });
  browser.tabs.onRemoved.addListener((tabId) => void serial(() => forgetParkedTab(tabId)));

  browser.runtime.onMessage.addListener((message: Request, _sender, sendResponse) => {
    if (message?.type === 'session/start') {
      serial(() => startManually(message.taskId)).then(sendResponse, (err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : 'Couldn’t start the session.' }),
      );
      return true; // keep the channel open for the async response
    }
  });

  // Every time the worker wakes: make sure nothing is stale.
  void serial(() => reconcile({ catchUp: false }));
});
