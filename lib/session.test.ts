import { describe, expect, it } from 'vitest';
import type { Task } from './tasks';
import {
  buildBlockRule,
  canStart,
  findDueTask,
  findUpcomingTask,
  formatCountdown,
  liveSession,
  planRestore,
  shouldSweepTab,
} from './session';
import { isAllowedHost } from './domains';
import { dateKey, formatRemaining, timeOnDate } from './time';

const DAY = '2026-09-23';
const at = (hhmm: string, date = DAY) => timeOnDate(date, hhmm);

function task(start: string, end: string, extra: Partial<Task> = {}): Task {
  return { id: `${start}-${end}`, date: DAY, name: 'Task', start, end, allowedSites: ['notion.so'], createdAt: 0, ...extra };
}

describe('findDueTask', () => {
  const tasks = [task('09:00', '10:00'), task('10:00', '11:30')];

  it('finds the task whose block contains now', () => {
    expect(findDueTask(tasks, at('09:30'))?.start).toBe('09:00');
  });
  it('is inclusive at the start minute and exclusive at the end minute', () => {
    expect(findDueTask(tasks, at('09:00'))?.start).toBe('09:00');
    expect(findDueTask(tasks, at('10:00'))?.start).toBe('10:00');
    expect(findDueTask(tasks, at('11:30'))).toBeUndefined();
  });
  it('ignores tasks from other days', () => {
    expect(findDueTask([task('09:00', '10:00', { date: '2026-09-22' })], at('09:30'))).toBeUndefined();
  });
  it('handles no tasks', () => {
    expect(findDueTask([], at('09:30'))).toBeUndefined();
  });
  it('handles a block ending at 23:59 and the midnight after it', () => {
    const late = [task('23:00', '23:59')];
    expect(findDueTask(late, at('23:58'))).toBeDefined();
    expect(findDueTask(late, at('00:00', '2026-09-24'))).toBeUndefined();
  });
});

describe('canStart', () => {
  it('allows starting early or during, not after', () => {
    const t = task('14:00', '15:00');
    expect(canStart(t, at('08:00'))).toBe(true);
    expect(canStart(t, at('14:59'))).toBe(true);
    expect(canStart(t, at('15:00'))).toBe(false);
  });
  it("doesn't start yesterday's task", () => {
    expect(canStart(task('14:00', '15:00', { date: '2026-09-22' }), at('08:00'))).toBe(false);
  });
});

describe('liveSession', () => {
  const s = { taskId: 'x', startedAt: at('09:00'), endsAt: at('10:00'), source: 'manual' as const };
  it('treats a session as over at its end time', () => {
    expect(liveSession(s, at('09:59'))).toBe(s);
    expect(liveSession(s, at('10:00'))).toBeNull();
  });
});

describe('domains', () => {
  it('allows the domain and its subdomains, not look-alikes', () => {
    const sites = ['notion.so', 'google.com'];
    expect(isAllowedHost('notion.so', sites)).toBe(true);
    expect(isAllowedHost('www.notion.so', sites)).toBe(true);
    expect(isAllowedHost('docs.google.com', sites)).toBe(true);
    expect(isAllowedHost('notnotion.so', sites)).toBe(false);
    expect(isAllowedHost('notion.so.evil.com', sites)).toBe(false);
  });
  it('sweeps only http(s) tabs on non-allowed sites', () => {
    expect(shouldSweepTab('https://x.com/home', ['notion.so'])).toBe(true);
    expect(shouldSweepTab('https://www.notion.so/page', ['notion.so'])).toBe(false);
    expect(shouldSweepTab('chrome://extensions', ['notion.so'])).toBe(false);
    expect(shouldSweepTab(undefined, ['notion.so'])).toBe(false);
  });
});

describe('buildBlockRule', () => {
  it('redirects top-level http(s) navigations, excluding allowed domains', () => {
    const rule = buildBlockRule(['notion.so'], 'chrome-extension://abc/blocked.html');
    expect(rule.condition).toEqual({
      regexFilter: '^https?://.*',
      resourceTypes: ['main_frame'],
      excludedRequestDomains: ['notion.so'],
    });
    expect(rule.action.redirect.regexSubstitution).toBe('chrome-extension://abc/blocked.html#\\0');
  });
});

describe('time', () => {
  it('formats remaining time without reading zero early', () => {
    expect(formatRemaining(42 * 60_000)).toBe('42 min left');
    expect(formatRemaining(41 * 60_000 + 1)).toBe('42 min left');
    expect(formatRemaining(65 * 60_000)).toBe('1 h 5 min left');
    expect(formatRemaining(30_000)).toBe('Less than a minute left');
  });
  it('builds local date keys', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('heads-up', () => {
  const tasks = [task('10:00', '11:00'), task('11:00', '12:00')];
  it('finds a task starting within the next minute', () => {
    expect(findUpcomingTask(tasks, at('09:59'))?.start).toBe('10:00');
    expect(findUpcomingTask(tasks, at('09:58'))).toBeUndefined();
    expect(findUpcomingTask(tasks, at('10:00'))).toBeUndefined();
  });
  it('announces the next task during a back-to-back session, not the running one', () => {
    expect(findUpcomingTask(tasks, at('10:59'), '10:00-11:00')?.start).toBe('11:00');
  });
  it('formats the countdown', () => {
    expect(formatCountdown(60_000)).toBe('1:00');
    expect(formatCountdown(41_200)).toBe('0:42');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('planRestore', () => {
  const parked = { '1': 'https://x.com/home', '2': 'https://notion.so/a' };
  it('restores everything when no session follows', () => {
    expect(planRestore(parked, null)).toEqual({
      restore: [
        [1, 'https://x.com/home'],
        [2, 'https://notion.so/a'],
      ],
      keep: {},
    });
  });
  it('keeps tabs parked that the next task also disallows', () => {
    expect(planRestore(parked, ['notion.so'])).toEqual({
      restore: [[2, 'https://notion.so/a']],
      keep: { '1': 'https://x.com/home' },
    });
  });
});
