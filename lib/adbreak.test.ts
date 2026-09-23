import { describe, expect, it } from 'vitest';
import type { Task } from './tasks';
import {
  AD_BREAK_MS,
  AD_SPOT_COUNT,
  BREATHING_SPOT_MS,
  DEV_AD_BREAK_MS,
  DEV_AD_SPOT_COUNT,
  completedThisWeek,
  planAdBreak,
  spotAt,
} from './adbreak';

const full = (hasTestimonial: boolean) =>
  planAdBreak({ totalMs: AD_BREAK_MS, count: AD_SPOT_COUNT, breathingMs: BREATHING_SPOT_MS, hasTestimonial });

describe('planAdBreak', () => {
  it('is 12 spots adding up to exactly 10 minutes', () => {
    for (const has of [true, false]) {
      const spots = full(has);
      expect(spots).toHaveLength(12);
      expect(spots.reduce((s, x) => s + x.durationMs, 0)).toBe(600_000);
      const last = spots[spots.length - 1]!;
      expect(last.startMs + last.durationMs).toBe(600_000);
    }
  });
  it('has exactly one one-minute breathing spot, mid-break', () => {
    const b = full(true).filter((s) => s.kind === 'breathing');
    expect(b).toHaveLength(1);
    expect(b[0]!.durationMs).toBe(60_000);
    expect(b[0]!.index).toBe(6);
  });
  it('skips the testimonial when there is no data', () => {
    expect(full(false).some((s) => s.kind === 'testimonial')).toBe(false);
    expect(full(true).some((s) => s.kind === 'testimonial')).toBe(true);
  });
  it('never plays the same kind twice in a row', () => {
    for (const has of [true, false]) {
      const spots = full(has);
      for (let i = 1; i < spots.length; i++) expect(spots[i]!.kind).not.toBe(spots[i - 1]!.kind);
    }
  });
  it('counts variants per kind', () => {
    const pitches = full(true).filter((s) => s.kind === 'pitch');
    expect(pitches.map((s) => s.variant)).toEqual([0, 1, 2]);
  });
  it('compresses to 10 seconds for the developer setting', () => {
    const spots = planAdBreak({ totalMs: DEV_AD_BREAK_MS, count: DEV_AD_SPOT_COUNT, breathingMs: DEV_AD_BREAK_MS / 4, hasTestimonial: false });
    expect(spots.map((s) => s.durationMs)).toEqual([2500, 2500, 2500, 2500]);
    expect(spots.map((s) => s.kind)).toEqual(['pitch', 'countdown', 'breathing', 'finePrint']);
  });
});

describe('spotAt', () => {
  const spots = full(true);
  it('finds the playing spot and time within it', () => {
    expect(spotAt(spots, 0).spot.index).toBe(0);
    const s1 = spots[1]!;
    expect(spotAt(spots, s1.startMs + 5).spot.index).toBe(1);
    expect(spotAt(spots, s1.startMs + 5).spotElapsedMs).toBe(5);
    expect(spotAt(spots, 10 * 60_000 + 50).spot.index).toBe(11);
  });
});

describe('completedThisWeek', () => {
  const now = new Date(2026, 8, 23, 12).getTime(); // Wed
  const t = (id: string, date: string): Task => ({ id, date, name: id, start: '09:00', end: '10:00', allowedSites: [], createdAt: 0 });
  const tasks = [t('mon', '2026-09-21'), t('lastweek', '2026-09-18'), t('tue', '2026-09-22'), t('missed', '2026-09-22')];
  const outcomes = {
    mon: { outcome: 'completed' as const, at: new Date(2026, 8, 21, 10).getTime() },
    lastweek: { outcome: 'completed' as const, at: new Date(2026, 8, 18, 10).getTime() },
    tue: { outcome: 'completed' as const, at: new Date(2026, 8, 22, 10).getTime() },
    missed: { outcome: 'missed' as const, at: new Date(2026, 8, 22, 10).getTime() },
  };
  it('only this week, only completed, newest first', () => {
    expect(completedThisWeek(tasks, outcomes, now).map((x) => x.id)).toEqual(['tue', 'mon']);
  });
});
