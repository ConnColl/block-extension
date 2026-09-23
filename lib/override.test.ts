import { describe, expect, it } from 'vitest';
import {
  confessionMatches,
  passesLeft,
  pickConfessionLine,
  spendPass,
  weekStartKey,
} from './override';

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

describe('confession', () => {
  const target = 'I am voluntarily entering the scroll hole.';

  it('ignores capitalization, punctuation and extra spaces', () => {
    expect(confessionMatches('i am voluntarily entering the scroll hole', target)).toBe(true);
    expect(confessionMatches('  I AM voluntarily   entering the scroll-hole!!  ', target)).toBe(true);
  });
  it('still requires every word', () => {
    expect(confessionMatches('I am entering the scroll hole.', target)).toBe(false);
    expect(confessionMatches('I am voluntarily entering the scroll hole. Now.', target)).toBe(false);
    expect(confessionMatches('', target)).toBe(false);
  });
  it('drops apostrophes rather than splitting words', () => {
    expect(confessionMatches("im voluntarily entering", "I'm voluntarily entering")).toBe(true);
    expect(confessionMatches('i’m voluntarily entering', "I'm voluntarily entering")).toBe(true);
  });
  it('picks each line, and each is typed as written', () => {
    const picked = [0, 0.3, 0.6, 0.99].map((r) => pickConfessionLine(() => r));
    expect(new Set(picked).size).toBe(4);
    for (const line of picked) expect(confessionMatches(line.toLowerCase(), line)).toBe(true);
  });
});
