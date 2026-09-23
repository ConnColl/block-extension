/** Pure date/time helpers. No browser APIs, so they can be unit-tested. */

export function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(total, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Local calendar date as "YYYY-MM-DD". */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Epoch ms for a local "HH:MM" on a local "YYYY-MM-DD". */
export function timeOnDate(date: string, hhmm: string): number {
  const [y = 1970, mo = 1, d = 1] = date.split('-').map(Number);
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).getTime();
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function formatTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return timeFmt.format(d);
}

export function formatLength(start: string, end: string): string {
  return formatMinutes(toMinutes(end) - toMinutes(start));
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "42 min left", "1 h 5 min left", "Less than a minute left". Rounds up so it never reads 0 early. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ending now';
  const mins = Math.ceil(ms / 60_000);
  if (ms < 60_000) return 'Less than a minute left';
  return `${formatMinutes(mins)} left`;
}

export function formatToday(): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(
    new Date(),
  );
}
