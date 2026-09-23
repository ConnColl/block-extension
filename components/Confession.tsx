import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { confessionMatches } from '@/lib/override';
import { transition } from '@/lib/motion';

interface Props {
  sentence: string;
  onConfirm: () => void;
}

/**
 * Step 5b: with no passes left, the user types a confession. Forgiving of
 * capitalization, punctuation and spacing; paste and drop are disabled, because
 * typing it out is the point.
 */
export function Confession({ sentence, onConfirm }: Props) {
  const id = useId();
  const [typed, setTyped] = useState('');
  const [pasteHint, setPasteHint] = useState(false);
  const matches = confessionMatches(typed, sentence);

  const blockPaste = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setPasteHint(true);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (matches) onConfirm();
      }}
    >
      <p id={`${id}-sentence`} className="rounded-xl bg-surface px-5 py-4 text-lg leading-relaxed text-ink select-none">
        {sentence}
      </p>

      <label htmlFor={`${id}-input`} className="mt-6 block text-sm font-medium">
        Type it to continue
      </label>
      <textarea
        id={`${id}-input`}
        rows={3}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onPaste={blockPaste}
        onDrop={blockPaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (matches) onConfirm();
          }
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-describedby={`${id}-sentence ${id}-hint`}
        className="mt-2 w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-base leading-relaxed text-ink"
      />
      <p id={`${id}-hint`} aria-live="polite" className="mt-2 min-h-5 text-sm text-muted">
        {pasteHint ? 'Pasting is off. Type it out; that’s the point.' : 'Capitals and punctuation don’t matter.'}
      </p>

      <div className="mt-6">
        <button
          type="submit"
          disabled={!matches}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            matches ? 'border-accent bg-accent text-accent-ink hover:opacity-90' : 'border-line text-muted'
          }`}
        >
          <AnimatePresence initial={false}>
            {matches && (
              <motion.span
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1, transition: transition.quick }}
                exit={{ opacity: 0, transition: transition.exit }}
              >
                ✓
              </motion.span>
            )}
          </AnimatePresence>
          Release me
        </button>
        <span aria-live="polite" className="sr-only">
          {matches ? 'Matches. Press Enter to continue.' : ''}
        </span>
      </div>
    </form>
  );
}
