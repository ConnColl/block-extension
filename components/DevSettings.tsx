import { useEffect, useState } from 'react';
import { overrideLogItem, passesItem, type OverrideLogEntry } from '@/lib/override';
import { usePassesLeft } from '@/lib/hooks';
import { clearSampleData, devSettingsItem, fillSampleData, type DevSettings as Settings } from '@/lib/devSettings';

const timeFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/** Developer settings, for testing and demos. Collapsed and clearly labeled. */
export function DevSettings({ now }: { now: number }) {
  const passes = usePassesLeft(now);
  const [log, setLog] = useState<OverrideLogEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sampleMsg, setSampleMsg] = useState('');

  useEffect(() => {
    devSettingsItem.getValue().then(setSettings);
    return devSettingsItem.watch(setSettings);
  }, []);

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

      <label className="mt-6 flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium">Short ad break</span>
          <span className="block text-sm text-muted">The 10-minute ad break lasts 10 seconds (4 spots).</span>
        </span>
        <input
          type="checkbox"
          className="size-4 accent-[var(--accent)]"
          checked={settings?.shortAdBreak ?? false}
          disabled={!settings}
          onChange={(e) => void devSettingsItem.setValue({ ...(settings ?? { shortAdBreak: false }), shortAdBreak: e.target.checked })}
        />
      </label>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Sample data</p>
          <p className="text-sm text-muted">
            {sampleMsg || 'Completed tasks earlier this week, for the Testimonial. Labeled “Sample” everywhere.'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={async () => {
              const n = await fillSampleData();
              setSampleMsg(n ? `Added ${n} sample completed ${n === 1 ? 'task' : 'tasks'}.` : 'No free slots for sample tasks.');
            }}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface"
          >
            Fill
          </button>
          <button
            type="button"
            onClick={async () => {
              const n = await clearSampleData();
              setSampleMsg(`Removed ${n} sample ${n === 1 ? 'task' : 'tasks'}.`);
            }}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface"
          >
            Clear
          </button>
        </div>
      </div>

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
