import { useEffect, useState } from 'react';
import { overrideLogItem, passesItem, type OverrideLogEntry } from '@/lib/override';
import { usePassesLeft } from '@/lib/hooks';

const timeFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Developer settings, for testing and demos. Collapsed and clearly labeled.
 * Step 5c adds the short ad break and sample data.
 */
export function DevSettings({ now }: { now: number }) {
  const passes = usePassesLeft(now);
  const [log, setLog] = useState<OverrideLogEntry[]>([]);

  useEffect(() => {
    overrideLogItem.getValue().then(setLog);
    return overrideLogItem.watch(setLog);
  }, []);

  return (
    <details className="group mt-24 rounded-2xl border border-dashed border-line px-6 py-4">
      <summary className="cursor-pointer text-sm font-medium text-muted select-none group-open:text-ink">
        Developer settings
      </summary>
      <p className="mt-2 text-sm text-muted">For testing and demos. These change your real data.</p>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Emergency passes</p>
          <p className="text-sm text-muted">{passes === null ? '…' : `${passes} left this week`}</p>
        </div>
        <button
          type="button"
          onClick={() => void passesItem.setValue(null)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface"
        >
          Reset passes
        </button>
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium">Override log</p>
        {log.length === 0 ? (
          <p className="mt-1 text-sm text-muted">No overrides yet.</p>
        ) : (
          <ol className="mt-2 space-y-1 text-sm text-muted">
            {[...log]
              .reverse()
              .slice(0, 10)
              .map((e) => (
                <li key={`${e.at}-${e.taskId}`} className="tabular-nums">
                  {timeFmt.format(e.at)} · {e.taskName || 'Untitled'} · {e.method} · {e.result} at {e.stage} ·{' '}
                  {e.passesLeft} left
                </li>
              ))}
          </ol>
        )}
      </div>
    </details>
  );
}
