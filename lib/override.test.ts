import { describe, expect, it } from 'vitest';
import { passesLeft, spendPass, weekStartKey } from './override';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('weekStartKey', () => {
  it('is the local Monday of the week', () => {
    expect(weekStartKey(at(2026, 9, 23))).toBe('2026-09-21'); // Wednesday
    expect(weekStartKey(at(2026, 9, 21, 0))).toBe('2026-09-21'); // Monday 00:00
    expect(weekStartKey(at(2026, 9, 27, 23))).toBe('2026-09-21'); // Sunday night
    expect(weekStartKey(at(2026, 9, 28, 0))).toBe('2026-09-28'); // next Monday
    expect(weekStartKey(at(2026, 10, 1))).toBe('2026-09-28'); // across a month boundary
  });
});

describe('passes', () => {
  const wed = at(2026, 9, 23);
  it('starts at 3 and counts down', () => {
    let r = null;
    expect(passesLeft(r, wed)).toBe(3);
    r = spendPass(r, wed);
    r = spendPass(r, wed);
    expect(passesLeft(r, wed)).toBe(1);
    r = spendPass(r, wed);
    expect(passesLeft(r, wed)).toBe(0);
    expect(passesLeft(spendPass(r, wed), wed)).toBe(0);
  });
  it('resets on Monday', () => {
    const used = { weekStart: '2026-09-21', used: 3 };
    expect(passesLeft(used, at(2026, 9, 28, 0))).toBe(3);
    expect(spendPass(used, at(2026, 9, 28, 9))).toEqual({ weekStart: '2026-09-28', used: 1 });
  });
});
