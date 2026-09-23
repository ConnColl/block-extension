import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { activeSessionItem, tasksItem, type Task } from '@/lib/tasks';
import {
  BLOCK_RULE_ID,
  buildBlockRule,
  canStart,
  findDueTask,
  isExpired,
  isToday,
  shouldSweepTab,
  taskEndMs,
  taskStartMs,
  type ActiveSession,
  type SessionSource,
} from '@/lib/session';
import type { Request, Response } from '@/lib/messages';

const START_ALARM_PREFIX = 'start:';
const END_ALARM = 'session-end';
const BLOCKED_PAGE = browser.runtime.getURL('/blocked.html');

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

/** Make the redirect rule match the session: present while one runs, absent otherwise. */
async function syncBlockRule(task: Task | null) {
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [BLOCK_RULE_ID],
    addRules: task ? [buildBlockRule(task.allowedSites, BLOCKED_PAGE)] : [],
  });
}

async function startSession(task: Task, source: SessionSource) {
  const session: ActiveSession = { taskId: task.id, startedAt: Date.now(), endsAt: taskEndMs(task), source };
  await syncBlockRule(task);
  await activeSessionItem.setValue(session);
  await browser.alarms.create(END_ALARM, { when: session.endsAt });

  // The rule only catches new navigations; send tabs already on other sites to the Blocked page.
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs
      .filter((tab) => tab.id !== undefined && shouldSweepTab(tab.url, task.allowedSites))
      .map((tab) => browser.tabs.update(tab.id!, { url: `${BLOCKED_PAGE}#${tab.url}` }).catch(() => {})),
  );
}

async function endSession() {
  await activeSessionItem.setValue(null);
  await syncBlockRule(null);
  await browser.alarms.clear(END_ALARM);
}

/**
 * Bring storage, the block rule and alarms into agreement.
 * With `catchUp`, a task whose block is running right now starts (used when
 * Chrome starts or the extension is installed/reloaded, i.e. we may have missed its start).
 */
async function reconcile({ catchUp }: { catchUp: boolean }) {
  const now = Date.now();
  const tasks = await tasksItem.getValue();
  let session = await activeSessionItem.getValue();
  const sessionTask = session ? tasks.find((t) => t.id === session!.taskId) : undefined;

  if (session && (isExpired(session, now) || !sessionTask)) {
    await endSession();
    session = null;
  }

  if (session && sessionTask) {
    // Re-assert in case the rule or alarm was lost (e.g. extension reloaded mid-session).
    await syncBlockRule(sessionTask);
    await browser.alarms.create(END_ALARM, { when: session.endsAt });
  } else {
    await syncBlockRule(null);
    const due = catchUp ? findDueTask(tasks, now) : undefined;
    if (due) await startSession(due, 'scheduled');
  }

  await scheduleStarts(tasks, now);
}

/** One alarm per task that starts later today. */
async function scheduleStarts(tasks: Task[], now: number) {
  const alarms = await browser.alarms.getAll();
  await Promise.all(
    alarms.filter((a) => a.name.startsWith(START_ALARM_PREFIX)).map((a) => browser.alarms.clear(a.name)),
  );
  await Promise.all(
    tasks
      .filter((t) => isToday(t, now) && taskStartMs(t) > now)
      .map((t) => browser.alarms.create(`${START_ALARM_PREFIX}${t.id}`, { when: taskStartMs(t) })),
  );
}

async function onStartAlarm(taskId: string) {
  await reconcile({ catchUp: false }); // ends a previous session whose end alarm hasn't fired yet
  if (await activeSessionItem.getValue()) return;
  const task = (await tasksItem.getValue()).find((t) => t.id === taskId);
  if (task && canStart(task, Date.now())) await startSession(task, 'scheduled');
}

async function startManually(taskId: string): Promise<Response> {
  await reconcile({ catchUp: false });
  if (await activeSessionItem.getValue()) {
    return { ok: false, error: 'A focus session is already running.' };
  }
  const task = (await tasksItem.getValue()).find((t) => t.id === taskId);
  if (!task) return { ok: false, error: 'That task no longer exists.' };
  if (!canStart(task, Date.now())) return { ok: false, error: 'This task’s time has already passed.' };
  await startSession(task, 'manual');
  return { ok: true };
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => void serial(() => reconcile({ catchUp: true })));
  browser.runtime.onStartup.addListener(() => void serial(() => reconcile({ catchUp: true })));

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === END_ALARM) void serial(() => reconcile({ catchUp: false }));
    else if (alarm.name.startsWith(START_ALARM_PREFIX)) {
      void serial(() => onStartAlarm(alarm.name.slice(START_ALARM_PREFIX.length)));
    }
  });

  // Task edits reschedule start alarms.
  tasksItem.watch(() => void serial(() => reconcile({ catchUp: false })));

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
