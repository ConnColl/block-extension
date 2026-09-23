import { describe, expect, it } from 'vitest';
import type { Task } from './tasks';
import { doneSummary, nextTaskAfter, shiftedTo, trimmedEnd } from './completion';
import { timeOnDate, toMinutes } from './time';

const D = '2026-09-23';
const t = (id: string, start: string, end: string, date = D): Task => ({ id, date, name: id, start, end, allowedSites: [], createdAt: 0 });
const at = (hhmm: string) => timeOnDate(D, hhmm);

describe('doneSummary', () => {
  const s = { taskId: 'a', startedAt: at('10:00'), endsAt: at('11:00'), source: 'scheduled' as const };
  it('reads "16 of 60 minutes" and earns the rest', () => {
    expect(doneSummary(s, at('10:16') + 30_000)).toEqual({ elapsedMin: 16, totalMin: 60, earnedMin: 44 });
  });
  it('stays within the session', () => {
    expect(doneSummary(s, at('09:00'))).toEqual({ elapsedMin: 0, totalMin: 60, earnedMin: 60 });
    expect(doneSummary(s, at('12:00'))).toEqual({ elapsedMin: 60, totalMin: 60, earnedMin: 0 });
  });
});

describe('nextTaskAfter', () => {
  const cur = t('cur', '10:00', '11:00');
  const tasks = [t('early', '08:00', '09:00'), cur, t('later', '14:00', '15:00'), t('next', '11:30', '12:30'), t('tomorrow', '11:00', '12:00', '2026-09-24')];
  it('is the earliest later task today', () => {
    expect(nextTaskAfter(tasks, cur)?.id).toBe('next');
  });
  it('skips finished tasks, and is undefined when nothing is left', () => {
    expect(nextTaskAfter(tasks, cur, { next: {} })?.id).toBe('later');
    expect(nextTaskAfter(tasks, cur, { next: {}, later: {} })).toBeUndefined();
  });
});

describe('trimmedEnd / shiftedTo', () => {
  it('ends the finished task now, at least a minute after it started', () => {
    expect(trimmedEnd({ start: '10:00', end: '11:00' }, toMinutes('10:16'))).toBe('10:16');
    expect(trimmedEnd({ start: '10:00', end: '11:00' }, toMinutes('10:00'))).toBe('10:01');
    expect(trimmedEnd({ start: '10:00', end: '11:00' }, toMinutes('11:30'))).toBe('11:00');
  });
  it('moves the next task and keeps its length', () => {
    expect(shiftedTo({ start: '11:30', end: '12:30' }, toMinutes('10:16'))).toEqual({ start: '10:16', end: '11:16' });
    expect(shiftedTo({ start: '22:00', end: '23:30' }, toMinutes('23:00'))).toEqual({ start: '23:00', end: '23:59' });
  });
});

describe('finishing early frees the rest of the slot', () => {
  it('a new task fits in the time after the actual end, and is suggested there', async () => {
    const { findOverlap } = await import('./tasks');
    const { suggestSlot } = await import('./schedule');
    const planned = t('a', '11:10', '12:10');
    const finished = { ...planned, end: trimmedEnd(planned, toMinutes('11:26')) };
    expect(finished.end).toBe('11:26');
    const slot = { start: '11:30', end: '12:00' };
    expect(findOverlap(slot, [planned])?.id).toBe('a');
    expect(findOverlap(slot, [finished])).toBeUndefined();
    expect(suggestSlot([finished], toMinutes('11:26'))).toEqual({ start: '11:30', end: '12:30' });
  });
});
