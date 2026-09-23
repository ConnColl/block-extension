import { describe, expect, it } from 'vitest';
import type { Task } from './tasks';
import { partitionSchedule, progressThrough, suggestSlot } from './schedule';
import { toMinutes } from './time';

const t = (id: string, start: string, end: string): Task => ({
  id, date: '2026-09-23', name: id, start, end, allowedSites: ['a.com'], createdAt: 0,
});
const m = toMinutes;

describe('suggestSlot', () => {
  it('starts at now, rounded up to 5 minutes, for an hour', () => {
    expect(suggestSlot([], m('10:42'))).toEqual({ start: '10:45', end: '11:45' });
    expect(suggestSlot([], m('10:45'))).toEqual({ start: '10:45', end: '11:45' });
    expect(suggestSlot([], m('13:01'))).toEqual({ start: '13:05', end: '14:05' });
  });
  it('moves past a task already using that time, including back-to-back ones', () => {
    expect(suggestSlot([t('a', '10:30', '11:15')], m('10:42'))).toEqual({ start: '11:15', end: '12:15' });
    expect(suggestSlot([t('b', '11:15', '12:00'), t('a', '10:30', '11:15')], m('10:42'))).toEqual({
      start: '12:00',
      end: '13:00',
    });
  });
  it("stops before the next task instead of overlapping it", () => {
    expect(suggestSlot([t('a', '11:00', '12:00')], m('10:42'))).toEqual({ start: '10:45', end: '11:00' });
  });
  it('ignores earlier tasks and caps at 11:59 PM', () => {
    expect(suggestSlot([t('a', '08:00', '09:00')], m('10:42'))).toEqual({ start: '10:45', end: '11:45' });
    expect(suggestSlot([], m('23:30'))).toEqual({ start: '23:30', end: '23:59' });
  });
});

describe('partitionSchedule', () => {
  const tasks = [t('past', '08:00', '09:00'), t('now', '10:00', '11:00'), t('next', '11:00', '12:00'), t('later', '14:00', '15:00')];
  it('splits into current, upcoming and earlier', () => {
    const p = partitionSchedule(tasks, m('10:30'));
    expect(p.current?.id).toBe('now');
    expect(p.upcoming.map((x) => x.id)).toEqual(['next', 'later']);
    expect(p.earlier.map((x) => x.id)).toEqual(['past']);
  });
  it('moves a task to earlier at its end minute', () => {
    const p = partitionSchedule(tasks, m('11:00'));
    expect(p.current?.id).toBe('next');
    expect(p.earlier.map((x) => x.id)).toEqual(['past', 'now']);
  });
  it('puts finished tasks (ended early) under earlier even while their time runs', () => {
    const p = partitionSchedule(tasks, m('10:30'), { now: {} });
    expect(p.current).toBeUndefined();
    expect(p.earlier.map((x) => x.id)).toEqual(['past', 'now']);
  });
});

describe('progressThrough', () => {
  it('is 0–1 through the task', () => {
    expect(progressThrough(t('x', '10:00', '11:00'), m('10:15'))).toBe(0.25);
    expect(progressThrough(t('x', '10:00', '11:00'), m('09:00'))).toBe(0);
    expect(progressThrough(t('x', '10:00', '11:00'), m('12:00'))).toBe(1);
  });
});

describe('partitionSchedule ordering', () => {
  it('lists each group in time order even if storage is unsorted', () => {
    const p = partitionSchedule([t('b', '09:50', '10:20'), t('a', '08:50', '09:20'), t('d', '14:00', '15:00'), t('c', '12:00', '13:00')], m('11:00'));
    expect(p.earlier.map((x) => x.id)).toEqual(['a', 'b']);
    expect(p.upcoming.map((x) => x.id)).toEqual(['c', 'd']);
  });
});
