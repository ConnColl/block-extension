/**
 * The ad break: 10 unskippable minutes of "ads" made only from the user's own
 * data, never real ads. Pure logic, unit-tested. Durations here are policy
 * constants (how long the break is), not motion tokens.
 */
import type { Task } from './tasks';
import type { TaskOutcome } from './override';
import { weekStartKey } from './override';
import { timeOnDate } from './time';

/** Port name the override page uses to hold an ad break open with the background. */
export const AD_PORT = 'ad-break';

export const AD_BREAK_MS = 10 * 60_000;
export const AD_SPOT_COUNT = 12;
export const BREATHING_SPOT_MS = 60_000;

/** Developer setting: the whole break in 10 seconds, as 4 spots. */
export const DEV_AD_BREAK_MS = 10_000;
export const DEV_AD_SPOT_COUNT = 4;

/** Breathing pace for the breathing spot. Pacing constants, not motion tokens. */
export const BREATHE_IN_MS = 4_000;
export const BREATHE_OUT_MS = 6_000;

/** The server-side check allows this much clock slack when the page says the break is done. */
export const AD_COMPLETE_TOLERANCE_MS = 1_000;

export type SpotKind = 'pitch' | 'countdown' | 'testimonial' | 'breathing' | 'finePrint' | 'allowedSites';

export interface Spot {
  kind: SpotKind;
  /** 0-based position in the break. */
  index: number;
  startMs: number;
  durationMs: number;
  /** nth appearance of this kind, for varied copy. */
  variant: number;
}

const CYCLE: SpotKind[] = ['pitch', 'countdown', 'testimonial', 'finePrint', 'allowedSites'];

/**
 * The spot sequence. One breathing spot sits in the middle; the other slots cycle
 * through the spot kinds that have data. Durations add up to exactly `totalMs`.
 */
export function planAdBreak(opts: {
  totalMs: number;
  count: number;
  breathingMs: number;
  hasTestimonial: boolean;
}): Spot[] {
  const { totalMs, count, breathingMs } = opts;
  const kinds = CYCLE.filter((k) => k !== 'testimonial' || opts.hasTestimonial);
  const breathingAt = Math.floor(count / 2);
  const others = count - 1;
  const eachOther = Math.floor((totalMs - breathingMs) / others);

  const seen: Partial<Record<SpotKind, number>> = {};
  const spots: Spot[] = [];
  let start = 0;
  let k = 0;
  for (let i = 0; i < count; i++) {
    const kind: SpotKind = i === breathingAt ? 'breathing' : kinds[k++ % kinds.length]!;
    const durationMs = kind === 'breathing' ? breathingMs : eachOther;
    const variant = seen[kind] ?? 0;
    seen[kind] = variant + 1;
    spots.push({ kind, index: i, startMs: start, durationMs, variant });
    start += durationMs;
  }
  // Rounding leftovers go to the last spot so the break is exactly totalMs.
  spots[spots.length - 1]!.durationMs += totalMs - start;
  return spots;
}

export function spotAt(spots: Spot[], elapsedMs: number): { spot: Spot; spotElapsedMs: number } {
  const spot = spots.find((s) => elapsedMs < s.startMs + s.durationMs) ?? spots[spots.length - 1]!;
  return { spot, spotElapsedMs: Math.max(0, Math.min(spot.durationMs, elapsedMs - spot.startMs)) };
}

/** Tasks marked completed this week (Monday 00:00 onward), newest first. Real data only. */
export function completedThisWeek(tasks: Task[], outcomes: Record<string, TaskOutcome>, now: number): Task[] {
  const weekStart = timeOnDate(weekStartKey(now), '00:00');
  return tasks
    .filter((t) => {
      const o = outcomes[t.id];
      return o?.outcome === 'completed' && o.at >= weekStart && o.at <= now;
    })
    .sort((a, b) => outcomes[b.id]!.at - outcomes[a.id]!.at);
}

/** Tiny disclaimer-style humour for The Fine Print. Self-aware, never cruel. */
export const FINE_PRINT = [
  'Side effects of sitting through this break may include finishing your task.',
  'Morning You is not responsible for content consumed after this message.',
  'No outties were harmed in the making of this break.',
  'Terms and conditions apply. The terms are: you set this up.',
  'Results not typical. Actually, fairly typical.',
  'This break is unskippable in all fifty states, and in this tab.',
] as const;
