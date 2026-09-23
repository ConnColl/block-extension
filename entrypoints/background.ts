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
  type SessionSource,
} from '@/lib/session';
import type { Request, Response } from '@/lib/messages';
import { doneSummary, nextTaskAfter, shiftedTo, trimmedEnd } from '@/lib/completion';
import { sortTasks } from '@/lib/tasks';
import { toMinutes } from '@/lib/time';
import {
  completionLogItem,
  type CompletionLogEntry,
  outcomesItem,
  overrideLogItem,
  passesItem,
  passesLeft,
  spendPass,
  type OverrideLogEntry,
  type OverrideStage,
} from '@/lib/override';
import {
  AD_BREAK_MS,
  AD_COMPLETE_TOLERANCE_MS,
  AD_PORT,
  DEV_AD_BREAK_MS,
} from '@/lib/adbreak';
import { devSettingsItem } from '@/lib/devSettings';
import {
  STARTUP_GRACE_MS,
  TAB_LIMIT,
  countTabs,
  parkedTabsItem,
  type TabLimitNotice,
} from '@/lib/tabs';

const START_ALARM_PREFIX = 'start:';
const HEADS_UP_ALARM_PREFIX = 'heads-up:';
const END_ALARM = 'session-end';
const BLOCKED_PAGE = browser.runtime.getURL('/blocked.html');

// Tab and window ids only mean something while Chrome is running, so these live in session storage.
/** When this browser session's worker first ran. Session storage is wiped when Chrome restarts. */
const startupAtItem = storage.defineItem<number | null>('session:startupAt', { fallback: null });

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

}

/** End the session. If another task is due right now (back-to-back), hand straight over to it. */
async function endSession(tasks: Task[], now: number) {
  const next = findDueTask(tasks, now, await outcomesItem.getValue());
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
}

/**
 * Bring storage, the block rule, alarms and the heads-up into agreement.
 * With `catchUp`, a task whose block is running right now starts (used when
 * Chrome starts or the extension is installed/reloaded, i.e. we may have missed its start).
 */
async function reconcile({ catchUp }: { catchUp: boolean }) {
  await freeOverriddenSlots();
  const now = Date.now();
  const tasks = await tasksItem.getValue();
  let session = await activeSessionItem.getValue();
  const sessionTask = session ? tasks.find((t) => t.id === session!.taskId) : undefined;

  if (session && (isExpired(session, now) || !sessionTask)) {
    await settleAdBreaks(session.taskId, 'outlasted');
    // Ended on its own: ask "Did you finish?". Unanswered counts as missed.
    const outcomes = await outcomesItem.getValue();
    const askAbout = sessionTask && !(sessionTask.id in outcomes) ? sessionTask : null;
    if (askAbout) {
      await outcomesItem.setValue({ ...outcomes, [askAbout.id]: { outcome: 'missed', at: session.endsAt, pending: true } });
    }
    await endSession(tasks, now);
    if (askAbout) askOnActiveTab(askAbout);
    session = await activeSessionItem.getValue();
  } else if (session && sessionTask) {
    // Re-assert in case the rule or alarm was lost (e.g. extension reloaded mid-session).
    await syncBlockRule(sessionTask);
    await browser.alarms.create(END_ALARM, { when: session.endsAt });
  } else {
    await syncBlockRule(null);
    const due = catchUp ? findDueTask(tasks, now, await outcomesItem.getValue()) : undefined;
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

/** Show the "Severing in 1:00" heads-up for the next scheduled task starting within a minute; clear it otherwise. */
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
    if (task && canStart(task, Date.now(), await outcomesItem.getValue())) await startSession(task, 'scheduled');
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
  if (task.id in (await outcomesItem.getValue())) return { ok: false, error: 'This task has already ended.' };
  if (!canStart(task, Date.now())) return { ok: false, error: 'This task’s time has already passed.' };
  await startSession(task, 'manual');
  await syncUpcoming(tasks, Date.now(), task.id);
  return { ok: true };
}

async function logOverride(entry: Omit<OverrideLogEntry, 'at'>) {
  const log = await overrideLogItem.getValue();
  await overrideLogItem.setValue([...log, { at: Date.now(), ...entry }]);
}

/** Override with an emergency pass: spend it, log it, and end the session for good. */
const minutesOfDay = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * A task that ends before its planned end frees the rest of its slot: its end time
 * becomes now (at least a minute after it started), and the planned end is kept on
 * its outcome. Overlap checks, time suggestions and the schedule all read `end`.
 */
async function endTaskNow(taskId: string, outcome: 'overridden' | 'completed', now: number): Promise<Task[]> {
  const tasks = await tasksItem.getValue();
  const task = tasks.find((t) => t.id === taskId);
  const outcomes = await outcomesItem.getValue();
  if (!task) return tasks;
  const end = trimmedEnd(task, minutesOfDay(now));
  const updated = sortTasks(tasks.map((t) => (t.id === taskId ? { ...t, end } : t)));
  await outcomesItem.setValue({
    ...outcomes,
    [taskId]: { outcome, at: now, early: true, plannedEnd: task.end },
  });
  await tasksItem.setValue(updated);
  return updated;
}

/** One-off repair: tasks overridden before ends were trimmed still hold their whole slot. */
async function freeOverriddenSlots() {
  const outcomes = await outcomesItem.getValue();
  const tasks = await tasksItem.getValue();
  let changed = false;
  const nextOutcomes = { ...outcomes };
  const updated = tasks.map((t) => {
    const o = outcomes[t.id];
    if (o?.outcome !== 'overridden' || o.plannedEnd || !isToday(t, o.at) || taskEndMs(t) <= o.at) return t;
    changed = true;
    nextOutcomes[t.id] = { ...o, early: true, plannedEnd: t.end };
    return { ...t, end: trimmedEnd(t, minutesOfDay(o.at)) };
  });
  if (!changed) return;
  await outcomesItem.setValue(nextOutcomes);
  await tasksItem.setValue(sortTasks(updated));
}

async function overrideWithPass(taskId: string): Promise<Response> {
  const now = Date.now();
  const session = liveSession(await activeSessionItem.getValue(), now);
  if (!session || session.taskId !== taskId) return { ok: false, error: 'This session has already ended.' };
  const record = await passesItem.getValue();
  const left = passesLeft(record, now);
  if (left === 0) return { ok: false, error: 'No emergency passes left this week.' };

  const task = (await tasksItem.getValue()).find((t) => t.id === taskId);
  await passesItem.setValue(spendPass(record, now));
  const tasks = await endTaskNow(taskId, 'overridden', now);
  await logOverride({
    taskId,
    taskName: task?.name ?? '',
    method: 'pass',
    result: 'ended',
    stage: 'hold',
    passesLeft: left - 1,
  });
  await endSession(tasks, now); // the outcome keeps this task from restarting
  await syncUpcoming(tasks, now);
  return { ok: true, passesLeft: left - 1 };
}

async function logCompletion(entry: Omit<CompletionLogEntry, 'at'>, at = Date.now()) {
  await completionLogItem.setValue([...(await completionLogItem.getValue()), { at, ...entry }]);
}

/**
 * "Done" during a session. Honor-based by design: Block is a commitment device,
 * not a lie detector. The task ends now (its end time moves to now); then either
 * the next task starts immediately at its planned length, or the time is taken back.
 */
async function finishEarly(taskId: string, then: 'start-next' | 'take-back'): Promise<Response> {
  const now = Date.now();
  const session = liveSession(await activeSessionItem.getValue(), now);
  if (!session || session.taskId !== taskId) return { ok: false, error: 'This session has already ended.' };
  const tasks = await tasksItem.getValue();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: 'That task no longer exists.' };
  const outcomes = await outcomesItem.getValue();
  const next = then === 'start-next' ? nextTaskAfter(tasks, task, outcomes) : undefined;
  if (then === 'start-next' && !next) return { ok: false, error: 'There’s no next task today.' };

  const { elapsedMin, totalMin, earnedMin } = doneSummary(session, now);
  const trimmed = await endTaskNow(task.id, 'completed', now);
  const end = trimmed.find((t) => t.id === task.id)!.end;
  const movedNext = next ? { ...next, ...shiftedTo(next, toMinutes(end)) } : undefined;
  const updated = movedNext ? sortTasks(trimmed.map((t) => (t.id === movedNext.id ? movedNext : t))) : trimmed;
  if (movedNext) await tasksItem.setValue(updated);
  await logCompletion({ taskId, taskName: task.name, outcome: 'completed', how: 'done-early', elapsedMin, plannedMin: totalMin, then }, now);

  if (movedNext) await startSession(movedNext, 'manual');
  else await endSession(updated, now);
  await syncUpcoming(updated, now, movedNext?.id);
  return {
    ok: true,
    earnedMinutes: movedNext ? undefined : earnedMin,
    next: movedNext ? { name: movedNext.name, end: movedNext.end } : undefined,
  };
}

/** "Did you finish?" Yes → completed at the task's end; No → missed. Stated neutrally either way. */
async function answerTask(taskId: string, finished: boolean): Promise<Response> {
  const task = (await tasksItem.getValue()).find((t) => t.id === taskId);
  if (!task) return { ok: false, error: 'That task no longer exists.' };
  const outcomes = await outcomesItem.getValue();
  const current = outcomes[taskId];
  if (current && !current.pending && current.outcome !== 'missed') return { ok: true };
  const at = current?.at ?? taskEndMs(task);
  await outcomesItem.setValue({ ...outcomes, [taskId]: { outcome: finished ? 'completed' : 'missed', at } });
  await logCompletion({ taskId, taskName: task.name, outcome: finished ? 'completed' : 'missed', how: 'answered' });
  return { ok: true };
}

/** A calm in-page question on the page the user is looking at when a session ends on its own. */
const ASK_DELAY_MS = 1500; // let restored tabs finish loading first
function askOnActiveTab(task: Task) {
  setTimeout(async () => {
    const [tab] = await browser.tabs
      .query({ active: true, lastFocusedWindow: true, windowType: 'normal' })
      .catch(() => []);
    if (tab?.id === undefined || !/^https?:\/\//.test(tab.url ?? '')) return; // Block's own pages ask themselves
    await browser.tabs
      .sendMessage(tab.id, { type: 'notice/session-ended', taskId: task.id, taskName: task.name })
      .catch(() => {});
  }, ASK_DELAY_MS);
}

/** "Back to work" (or leaving) during an override attempt. */
async function abandonOverride(taskId: string, stage: OverrideStage): Promise<Response> {
  const now = Date.now();
  const left = passesLeft(await passesItem.getValue(), now);
  const task = (await tasksItem.getValue()).find((t) => t.id === taskId);
  await logOverride({
    taskId,
    taskName: task?.name ?? '',
    method: left > 0 ? 'pass' : 'confession',
    result: 'abandoned',
    stage,
    passesLeft: left,
  });
  return { ok: true };
}

/**
 * The ad break. The override page holds a port open for the whole break; the
 * background times it, so the session only ends once the full break has really
 * run. Leaving the page (close, reload, navigate) disconnects the port: the
 * attempt is logged as abandoned and the next try starts over from Ad 1.
 */
type AdPortMessage = { type: 'start'; taskId: string } | { type: 'complete' } | { type: 'ping' };
interface AdRun {
  taskId: string;
  startedAt: number;
  durationMs: number;
  settled: boolean;
  port: Browser.runtime.Port;
}
const adRuns = new Set<AdRun>();

/** Close out running ad breaks for a task: the session ended on its own, or the page left. */
async function settleAdBreaks(taskId: string, result: 'outlasted' | 'abandoned', only?: AdRun) {
  for (const run of only ? [only] : adRuns) {
    if (run.settled || run.taskId !== taskId) continue;
    run.settled = true;
    const task = (await tasksItem.getValue()).find((t) => t.id === taskId);
    await logOverride({
      taskId,
      taskName: task?.name ?? '',
      method: 'confession',
      result,
      stage: 'ad-break',
      passesLeft: passesLeft(await passesItem.getValue(), Date.now()),
    });
    if (result === 'outlasted') run.port.postMessage({ type: 'outlasted' });
  }
}

async function onAdMessage(run: { current: AdRun | null }, port: Browser.runtime.Port, msg: AdPortMessage) {
  const now = Date.now();
  if (msg.type === 'start') {
    const session = liveSession(await activeSessionItem.getValue(), now);
    if (!session || session.taskId !== msg.taskId) return port.postMessage({ type: 'refused', error: 'This session has already ended.' });
    if (passesLeft(await passesItem.getValue(), now) > 0) {
      return port.postMessage({ type: 'refused', error: 'You still have an emergency pass. Use that instead.' });
    }
    const { shortAdBreak } = await devSettingsItem.getValue();
    run.current = { taskId: msg.taskId, startedAt: now, durationMs: shortAdBreak ? DEV_AD_BREAK_MS : AD_BREAK_MS, settled: false, port };
    adRuns.add(run.current);
    port.postMessage({ type: 'started', startedAt: now, durationMs: run.current.durationMs });
  } else if (msg.type === 'complete') {
    const r = run.current;
    if (!r || r.settled) return;
    if (now - r.startedAt < r.durationMs - AD_COMPLETE_TOLERANCE_MS) {
      return port.postMessage({ type: 'not-yet', remainingMs: r.durationMs - (now - r.startedAt) });
    }
    const session = liveSession(await activeSessionItem.getValue(), now);
    if (!session || session.taskId !== r.taskId) return settleAdBreaks(r.taskId, 'outlasted', r);
    r.settled = true;
    const tasks = await endTaskNow(r.taskId, 'overridden', now);
    await logOverride({
      taskId: r.taskId,
      taskName: tasks.find((t) => t.id === r.taskId)?.name ?? '',
      method: 'confession',
      result: 'ended',
      stage: 'ad-break',
      passesLeft: 0,
    });
    await endSession(tasks, now);
    await syncUpcoming(tasks, now);
    port.postMessage({ type: 'ended' });
  }
  // 'ping' only keeps the worker awake during the break.
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

/**
 * Tab limit. During a session, a new tab that would take the tabs in use over
 * TAB_LIMIT is closed, and the tab the user was on gets a calm notice. Parked
 * tabs are paused, not in use, so they don't count.
 */
async function enforceTabLimit(tab: Browser.tabs.Tab) {
  if (tab.id === undefined) return;
  const now = Date.now();
  const session = liveSession(await activeSessionItem.getValue(), now);
  if (!session) return;

  // Chrome restoring tabs after a restart isn't the user opening new ones.
  const startupAt = await startupAtItem.getValue();
  if (startupAt === null) await startupAtItem.setValue(now);
  if (startupAt === null || now - startupAt < STARTUP_GRACE_MS) return;

  const win = await browser.windows.get(tab.windowId).catch(() => null);
  if (win?.type !== 'normal') return; // popups (e.g. sign-in windows) aren't tabs in use

  const tabs = await browser.tabs.query({ windowType: 'normal' });
  const { inUse } = countTabs(tabs, await parkedTabsItem.getValue(), BLOCKED_PAGE);
  if (inUse <= TAB_LIMIT) return;

  const url = await waitForUrl(tab);
  await browser.tabs.remove(tab.id).catch(() => {});

  const target = await noticeTarget(tab);
  if (target === undefined) return;
  const task = (await tasksItem.getValue()).find((t) => t.id === session.taskId);
  const allowed = !!url && /^https?:\/\//.test(url) && !!task && !shouldSweepTab(url, task.allowedSites);
  const notice: TabLimitNotice = {
    type: 'notice/tab-limit',
    targetTabId: target,
    inUse: inUse - 1,
    limit: TAB_LIMIT,
    openHereUrl: allowed ? url : undefined,
  };
  // Web pages get it through the content script; Block's own pages through a broadcast.
  await browser.tabs.sendMessage(target, notice).catch(() => {});
  await browser.runtime.sendMessage(notice).catch(() => {});
}

/** Tabs opened from links often start with no URL; give Chrome a moment to fill it in so "Open here instead" can offer it. */
const URL_WAIT_MS = 1000;
const URL_POLL_MS = 50;
async function waitForUrl(tab: Browser.tabs.Tab): Promise<string | undefined> {
  const known = (t: Browser.tabs.Tab) => [t.pendingUrl, t.url].find((u) => u && u !== 'about:blank');
  const deadline = Date.now() + URL_WAIT_MS;
  let current: Browser.tabs.Tab | null = tab;
  while (current && !known(current) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, URL_POLL_MS));
    current = await browser.tabs.get(tab.id!).catch(() => null);
  }
  return current ? known(current) : undefined;
}

/** The tab the user was on: the one that opened the closed tab, else the active tab in that window (or the last focused one). */
async function noticeTarget(closed: Browser.tabs.Tab): Promise<number | undefined> {
  if (closed.openerTabId !== undefined) {
    const opener = await browser.tabs.get(closed.openerTabId).catch(() => null);
    if (opener?.id !== undefined) return opener.id;
  }
  const [inWindow] = await browser.tabs.query({ active: true, windowId: closed.windowId }).catch(() => []);
  if (inWindow?.id !== undefined) return inWindow.id;
  const [focused] = await browser.tabs.query({ active: true, lastFocusedWindow: true, windowType: 'normal' });
  return focused?.id;
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
  // Start the tab-limit grace period the first time the worker runs in this browser session.
  void startupAtItem.getValue().then(async (at) => {
    if (at === null) await startupAtItem.setValue(Date.now());
  });

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
  browser.tabs.onCreated.addListener((tab) => void serial(() => enforceTabLimit(tab)));
  browser.tabs.onRemoved.addListener((tabId) => void serial(() => forgetParkedTab(tabId)));

  browser.runtime.onMessage.addListener((message: Request, _sender, sendResponse) => {
    const handler =
      message?.type === 'session/start'
        ? () => startManually(message.taskId)
        : message?.type === 'override/pass'
          ? () => overrideWithPass(message.taskId)
          : message?.type === 'override/abandon'
            ? () => abandonOverride(message.taskId, message.stage)
            : message?.type === 'session/done'
              ? () => finishEarly(message.taskId, message.then)
              : message?.type === 'task/answer'
                ? () => answerTask(message.taskId, message.finished)
                : null;
    if (!handler) return;
    serial(handler).then(sendResponse, (err: unknown) =>
      sendResponse({ ok: false, error: err instanceof Error ? err.message : 'Something went wrong.' }),
    );
    return true; // keep the channel open for the async response
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== AD_PORT) return;
    const run: { current: AdRun | null } = { current: null };
    port.onMessage.addListener((msg: AdPortMessage) => void serial(() => onAdMessage(run, port, msg)));
    port.onDisconnect.addListener(() =>
      void serial(async () => {
        if (!run.current) return;
        // The page may notice the session's end time before the end alarm fires and close
        // first. If the session is over, the user outlasted it; otherwise they left.
        const s = await activeSessionItem.getValue();
        const over = !s || s.taskId !== run.current.taskId || isExpired(s, Date.now());
        await settleAdBreaks(run.current.taskId, over ? 'outlasted' : 'abandoned', run.current);
        adRuns.delete(run.current);
      }),
    );
  });

  // Every time the worker wakes: make sure nothing is stale.
  void serial(() => reconcile({ catchUp: false }));
});
