import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WHY_MAX_LENGTH, validateDraft, type Task, type TaskDraft } from '@/lib/tasks';
import { transition } from '@/lib/motion';
import { SitesInput, commitSiteText } from './SitesInput';

interface Props {
  idPrefix: string;
  initial: TaskDraft;
  /** Tasks to check for overlaps (excluding the one being edited). */
  others: Task[];
  submitLabel: string;
  onSubmit: (draft: TaskDraft) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
  /** Keep start/end in step with `initial` until the user changes either (new-task form). */
  followInitialTimes?: boolean;
}

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 aria-invalid:border-notice tabular-nums';
const labelClass = 'mb-1.5 block text-sm font-medium text-ink';

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          id={id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: transition.enter }}
          exit={{ opacity: 0, transition: transition.exit }}
          className="mt-1.5 text-sm text-notice"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function TaskForm({ idPrefix, initial, others, submitLabel, onSubmit, onCancel, autoFocus, followInitialTimes }: Props) {
  const [name, setName] = useState(initial.name);
  const [why, setWhy] = useState(initial.why ?? '');
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [sites, setSites] = useState(initial.allowedSites);
  const [siteText, setSiteText] = useState('');
  const [siteEntryError, setSiteEntryError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [timesTouched, setTimesTouched] = useState(false);

  // Default times move forward with the clock until the user sets their own.
  useEffect(() => {
    if (!followInitialTimes || timesTouched) return;
    setStart(initial.start);
    setEnd(initial.end);
  }, [followInitialTimes, timesTouched, initial.start, initial.end]);

  const id = (field: string) => `${idPrefix}-${field}`;
  const errors = attempted ? validateDraft({ name, why, start, end, allowedSites: sites }, others) : {};
  const sitesMessage = siteEntryError ?? errors.sites;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    // Pick up a site that was typed but not yet added with Enter.
    let allowedSites = sites;
    if (siteText.trim()) {
      const result = commitSiteText(siteText, sites);
      if (!result.ok) {
        setSiteEntryError(result.message);
        document.getElementById(id('sites'))?.focus();
        return;
      }
      allowedSites = result.sites;
      setSites(allowedSites);
      setSiteText('');
    }

    const draft: TaskDraft = { name, why, start, end, allowedSites };
    const found = validateDraft(draft, others);
    setAttempted(true);
    setSubmitError(null);
    if (found.name || found.time || found.sites) {
      const first = found.name ? 'name' : found.time ? 'start' : 'sites';
      document.getElementById(id(first))?.focus();
      return;
    }

    setBusy(true);
    try {
      await onSubmit(draft);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onCancel) {
          e.preventDefault();
          onCancel();
        }
      }}
      className="space-y-5"
    >
      <div>
        <label htmlFor={id('name')} className={labelClass}>
          Task
        </label>
        <input
          id={id('name')}
          type="text"
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder="Write the case study intro"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name || undefined}
          aria-describedby={errors.name ? id('name-error') : undefined}
          className={inputClass}
        />
        <FieldError id={id('name-error')} message={errors.name} />
      </div>

      <div>
        <label htmlFor={id('why')} className={labelClass}>
          Why <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id={id('why')}
          type="text"
          autoComplete="off"
          maxLength={WHY_MAX_LENGTH}
          placeholder="So the case study is ready to send on Friday"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          aria-describedby={id('why-hint')}
          className={inputClass}
        />
        <p id={id('why-hint')} className="mt-1.5 text-sm text-muted">
          One line, for future you.
        </p>
      </div>

      <fieldset>
        <legend className={labelClass}>Time</legend>
        <div className="flex items-center gap-3">
          <label htmlFor={id('start')} className="sr-only">
            Start time
          </label>
          <input
            id={id('start')}
            type="time"
            value={start}
            onChange={(e) => {
              setTimesTouched(true);
              setStart(e.target.value);
            }}
            aria-invalid={!!errors.time || undefined}
            aria-describedby={errors.time ? id('time-error') : undefined}
            className={inputClass}
          />
          <span aria-hidden="true" className="text-muted">
            –
          </span>
          <label htmlFor={id('end')} className="sr-only">
            End time
          </label>
          <input
            id={id('end')}
            type="time"
            value={end}
            onChange={(e) => {
              setTimesTouched(true);
              setEnd(e.target.value);
            }}
            aria-invalid={!!errors.time || undefined}
            aria-describedby={errors.time ? id('time-error') : undefined}
            className={inputClass}
          />
        </div>
        <FieldError id={id('time-error')} message={errors.time} />
      </fieldset>

      <div>
        <label htmlFor={id('sites')} className={labelClass}>
          Allowed sites
        </label>
        <p id={id('sites-hint')} className="-mt-1 mb-2 text-sm text-muted">
          Only these stay open during the task. Press Enter to add each one.
        </p>
        <SitesInput
          id={id('sites')}
          sites={sites}
          onSitesChange={setSites}
          text={siteText}
          onTextChange={setSiteText}
          onEntryError={setSiteEntryError}
          invalid={!!sitesMessage}
          describedBy={`${id('sites-hint')}${sitesMessage ? ` ${id('sites-error')}` : ''}`}
        />
        <FieldError id={id('sites-error')} message={sitesMessage ?? undefined} />
      </div>

      <FieldError id={id('submit-error')} message={submitError ?? undefined} />

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
