import { motion, useReducedMotion } from 'motion/react';
import type { Task } from '@/lib/tasks';
import { BREATHE_IN_MS, BREATHE_OUT_MS, FINE_PRINT, type Spot } from '@/lib/adbreak';
import { formatCountdown } from '@/lib/session';
import { formatTime } from '@/lib/time';
import { easing } from '@/lib/motion';
import { SiteIcon } from './SiteIcon';

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long' });

const eyebrow = 'text-xs font-medium tracking-widest text-accent uppercase';

export interface SpotData {
  task: Task;
  /** Time left in the block (the session), for The Countdown. */
  blockRemainingMs: number;
  /** Tasks completed this week, newest first, with when. */
  completed: { task: Task; at: number }[];
}

/** One "ad". Every spot is built only from the user's own data. */
export function AdSpot({ spot, spotElapsedMs, data }: { spot: Spot; spotElapsedMs: number; data: SpotData }) {
  switch (spot.kind) {
    case 'pitch':
      return <Pitch variant={spot.variant} task={data.task} />;
    case 'countdown':
      return <Countdown data={data} />;
    case 'testimonial':
      return <Testimonial variant={spot.variant} completed={data.completed} />;
    case 'breathing':
      return <Breathing elapsedMs={spotElapsedMs} />;
    case 'finePrint':
      return <FinePrint variant={spot.variant} task={data.task} />;
    case 'allowedSites':
      return <AllowedSites task={data.task} />;
  }
}

/** Human names, for the screen-reader announcement. */
export const SPOT_NAMES: Record<Spot['kind'], string> = {
  pitch: 'The Pitch',
  countdown: 'The Countdown',
  testimonial: 'The Testimonial',
  breathing: 'The Breathing Spot',
  finePrint: 'The Fine Print',
  allowedSites: 'The Allowed Sites',
};

function Pitch({ variant, task }: { variant: number; task: Task }) {
  const leads = ['Now showing', 'Still showing', 'Back by popular demand'];
  return (
    <div className="text-center">
      <p className={eyebrow}>{leads[variant % leads.length]}</p>
      <h2 className="mt-4 text-4xl leading-tight font-semibold tracking-tight">{task.name}</h2>
      {task.why && <p className="mt-4 text-xl text-muted">“{task.why}”</p>}
      <p className="mt-6 text-sm text-muted">Only in this tab. Only for a limited time.</p>
    </div>
  );
}

function Countdown({ data }: { data: SpotData }) {
  return (
    <div className="text-center">
      <p className={eyebrow}>Limited time only</p>
      <p className="mt-4 text-7xl font-semibold tracking-tight tabular-nums">{formatCountdown(data.blockRemainingMs)}</p>
      <p className="mt-4 text-lg text-muted">
        left in “{data.task.name}” · ends {formatTime(data.task.end)}
      </p>
    </div>
  );
}

function Testimonial({ variant, completed }: { variant: number; completed: SpotData['completed'] }) {
  const n = completed.length;
  const start = (variant * 3) % Math.max(1, n);
  const shown = [...completed.slice(start), ...completed.slice(0, start)].slice(0, 3);
  const sample = shown.some((c) => c.task.sample);
  return (
    <div>
      <p className={`${eyebrow} text-center`}>What people are saying</p>
      <ul className="mx-auto mt-5 max-w-lg space-y-3">
        {shown.map(({ task, at }) => (
          <li key={task.id} className="rounded-xl border border-line bg-bg px-4 py-3">
            <p aria-label="Five stars" className="text-sm tracking-widest text-accent">
              ★★★★★
            </p>
            <p className="mt-1 text-base">“{task.name}. Done.”</p>
            <p className="mt-1 text-sm text-muted">Morning You · {dayFmt.format(at)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-center text-sm text-muted">
        {n} {n === 1 ? 'task' : 'tasks'} completed this week
        {sample && <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs">Sample data</span>}
      </p>
    </div>
  );
}

function Breathing({ elapsedMs }: { elapsedMs: number }) {
  const reduce = useReducedMotion();
  const cycle = BREATHE_IN_MS + BREATHE_OUT_MS;
  const inhaling = elapsedMs % cycle < BREATHE_IN_MS;
  const cycleIndex = Math.floor(elapsedMs / cycle);
  return (
    <div className="flex flex-col items-center text-center">
      <p className={eyebrow}>A word from your lungs</p>
      {!reduce && (
        <div className="relative mt-6 grid size-40 place-items-center">
          <motion.div
            // Keyed per half-breath so each one runs its full length from where the last ended.
            key={`${cycleIndex}-${inhaling}`}
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-accent-soft"
            initial={{ scale: inhaling ? 0.55 : 1 }}
            animate={{ scale: inhaling ? 1 : 0.55 }}
            transition={{ duration: (inhaling ? BREATHE_IN_MS : BREATHE_OUT_MS) / 1000, ease: easing.standard }}
          />
        </div>
      )}
      <p aria-live="polite" className={`${reduce ? 'mt-8 text-3xl' : 'mt-6 text-xl'} font-medium`}>
        {inhaling ? 'Breathe in…' : 'Breathe out…'}
      </p>
      <p className="mt-2 text-sm text-muted">One minute. Nothing to do but this.</p>
    </div>
  );
}

function FinePrint({ variant, task }: { variant: number; task: Task }) {
  const a = FINE_PRINT[(variant * 2) % FINE_PRINT.length];
  const b = FINE_PRINT[(variant * 2 + 1) % FINE_PRINT.length];
  return (
    <div className="mx-auto max-w-md text-center">
      <p className={eyebrow}>The fine print</p>
      <p className="mt-6 text-xs leading-relaxed text-muted">
        {a} {b} Offer valid until {formatTime(task.end)}. Void where focus is prohibited. Morning You makes no
        guarantees, only plans.
      </p>
    </div>
  );
}

function AllowedSites({ task }: { task: Task }) {
  return (
    <div className="text-center">
      <p className={eyebrow}>Also available in this tab</p>
      <ul className="mx-auto mt-5 flex max-w-md flex-col items-stretch gap-2">
        {task.allowedSites.map((site) => (
          <li key={site}>
            <a
              href={`https://${site}`}
              className="flex items-center justify-center gap-2.5 rounded-xl border border-line bg-bg px-4 py-3 text-base font-medium hover:border-accent"
            >
              <SiteIcon domain={site} />
              {site}
              <span aria-hidden="true" className="text-muted">
                →
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">One click. No break required.</p>
    </div>
  );
}

/** Spot progress: a thin line that runs the spot's length. Real time, so linear. */
export function SpotProgress({ spot, spotElapsedMs }: { spot: Spot; spotElapsedMs: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const from = spotElapsedMs / spot.durationMs;
  return (
    <div aria-hidden="true" className="h-0.5 overflow-hidden bg-line">
      <motion.div
        key={spot.index}
        className="h-full origin-left bg-accent"
        initial={{ scaleX: from }}
        animate={{ scaleX: 1 }}
        transition={{ duration: (spot.durationMs - spotElapsedMs) / 1000, ease: easing.linear }}
      />
    </div>
  );
}

