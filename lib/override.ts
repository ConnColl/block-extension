import { storage } from 'wxt/utils/storage';
import { dateKey } from './time';

/** Emergency passes per week. A policy constant. */
export const PASSES_PER_WEEK = 3;

/** Passes used in the week starting `weekStart` (a Monday, "YYYY-MM-DD"). */
export interface PassRecord {
  weekStart: string;
  used: number;
}

export const passesItem = storage.defineItem<PassRecord | null>('local:passes', { fallback: null });

/** The local Monday that starts the week containing `now`. Weeks reset Monday 00:00 local. */
export function weekStartKey(now: number): string {
  const d = new Date(now);
  const sinceMonday = (d.getDay() + 6) % 7; // Sunday → 6, Monday → 0
  return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday));
}

export function passesLeft(record: PassRecord | null, now: number): number {
  if (!record || record.weekStart !== weekStartKey(now)) return PASSES_PER_WEEK;
  return Math.max(0, PASSES_PER_WEEK - record.used);
}

/** The record after spending one pass (resetting first if it's a new week). */
export function spendPass(record: PassRecord | null, now: number): PassRecord {
  const weekStart = weekStartKey(now);
  const used = record?.weekStart === weekStart ? record.used : 0;
  return { weekStart, used: used + 1 };
}

/**
 * How a task's session finished. A task with an outcome never auto-starts or
 * offers "Start now" again. Step 6 adds `completed` and `missed`.
 */
export type TaskOutcome = { outcome: 'overridden' | 'completed' | 'missed'; at: number };
export const outcomesItem = storage.defineItem<Record<string, TaskOutcome>>('local:outcomes', { fallback: {} });

export type OverrideStage = 'hold' | 'confession' | 'ad-break';

export interface OverrideLogEntry {
  at: number;
  taskId: string;
  taskName: string;
  method: 'pass' | 'confession';
  /** ended: the override ended the session. abandoned: "Back to work" or left. outlasted: the session ended on its own during the ad break. */
  result: 'ended' | 'abandoned' | 'outlasted';
  /** Where the attempt stopped. */
  stage: OverrideStage;
  passesLeft: number;
}

export const overrideLogItem = storage.defineItem<OverrideLogEntry[]>('local:overrideLog', { fallback: [] });

/** Confession lines. One is picked at random per attempt and typed exactly as written. */
export const CONFESSION_LINES = [
  'I would like to abandon my potential please.',
  'I am voluntarily entering the scroll hole.',
  'Please return me to the content mines.',
  'I would rather consume content than become the person I said I wanted to be.',
] as const;

export function pickConfessionLine(random: () => number = Math.random): string {
  return CONFESSION_LINES[Math.floor(random() * CONFESSION_LINES.length)] ?? CONFESSION_LINES[0];
}

/**
 * Lowercase, drop apostrophes and quotes ("Maya's" → "mayas"), treat other
 * punctuation as a space ("case-study" → "case study"), collapse spaces.
 */
export function normalizeConfession(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’‘`´"“”]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Forgiving of capitalization, punctuation and spacing; the words themselves must match. */
export function confessionMatches(typed: string, target: string): boolean {
  const t = normalizeConfession(typed);
  return t.length > 0 && t === normalizeConfession(target);
}
