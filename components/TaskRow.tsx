import { motion } from 'motion/react';
import type { Task } from '@/lib/tasks';
import { formatLength, formatTime } from '@/lib/time';
import { SiteIcon } from './SiteIcon';
import { duration, easing } from '@/lib/motion';

interface Props {
  task: Task;
  locked: boolean;
  /** Time left, shown when this task is the active session. */
  remaining?: string;
  /** "Starts in 0:42" during the heads-up minute. */
  startsIn?: string;
  /** No session running and this task hasn't ended yet. */
  startable: boolean;
  /** Ended by an override. Stated neutrally. */
  endedEarly?: boolean;
  onStart: () => void;
  /** Just added or restored — the accent marker settles back to neutral. */
  settling: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskRow({ task, locked, remaining, startsIn, startable, endedEarly, settling, onStart, onEdit, onDelete }: Props) {
  return (
    <div className="flex gap-5 py-5">
      <div className="w-24 shrink-0 text-sm tabular-nums">
        <div className="font-medium text-ink">{formatTime(task.start)}</div>
        <div className="text-muted">{formatTime(task.end)}</div>
      </div>

      {/* The time block's marker: accent when it lands, then settles to neutral. */}
      <div aria-hidden="true" className="relative w-0.5 shrink-0 rounded-full bg-line">
        <motion.div
          className="absolute inset-0 rounded-full bg-accent"
          initial={{ opacity: settling ? 1 : 0 }}
          animate={{ opacity: 0 }}
          transition={{ duration: duration.emphasized, ease: easing.standard, delay: duration.emphasized }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-base font-medium text-ink">{task.name}</h3>
        {task.why && <p className="mt-0.5 text-sm text-ink/80">{task.why}</p>}
        <p className="mt-0.5 text-sm text-muted">
          {locked && remaining ? (
            <span className="font-medium text-accent">In session · {remaining}</span>
          ) : endedEarly ? (
            <>{formatLength(task.start, task.end)} · Ended early</>
          ) : startsIn ? (
            <span className="font-medium text-accent">Focus begins in {startsIn}</span>
          ) : (
            formatLength(task.start, task.end)
          )}
        </p>
        <ul aria-label="Allowed sites" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
          {task.allowedSites.map((site) => (
            <li key={site} className="flex items-center gap-1.5 break-all">
              <SiteIcon domain={site} />
              {site}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex shrink-0 items-start gap-1">
        {locked ? (
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-ink">Locked</span>
        ) : (
          <>
            {startable && (
              <button
                type="button"
                onClick={onStart}
                aria-label={`Start ${task.name} now`}
                className="rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft"
              >
                Start now
              </button>
            )}
            <button
              id={`edit-${task.id}`}
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${task.name}`}
              className="rounded-md px-2 py-1 text-sm text-muted hover:text-ink"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Delete ${task.name}`}
              className="rounded-md px-2 py-1 text-sm text-muted hover:text-ink"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
