import { motion } from 'motion/react';
import type { Task } from '@/lib/tasks';
import { formatLength, formatTime } from '@/lib/time';
import { duration, easing } from '@/lib/motion';

interface Props {
  task: Task;
  locked: boolean;
  /** Just added or restored — the accent marker settles back to neutral. */
  settling: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskRow({ task, locked, settling, onEdit, onDelete }: Props) {
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
        <p className="mt-0.5 text-sm text-muted">{formatLength(task.start, task.end)}</p>
        <p className="mt-2 text-sm break-words text-muted">
          <span className="sr-only">Allowed sites: </span>
          {task.allowedSites.join(' · ')}
        </p>
      </div>

      <div className="flex shrink-0 items-start gap-1">
        {locked ? (
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-ink">In session</span>
        ) : (
          <>
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
