import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { UNDO_WINDOW_MS } from '@/lib/tasks';
import { transition } from '@/lib/motion';

export interface UndoState {
  /** Changes whenever a fresh notice should restart the timer. */
  key: number;
  message: string;
  canUndo: boolean;
}

interface Props {
  notice: UndoState | null;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * "Deleted — Undo" notice. Disappears after UNDO_WINDOW_MS; the timer pauses
 * while the pointer or keyboard focus is on it, so nobody is rushed.
 */
export function UndoNotice({ notice, onUndo, onDismiss }: Props) {
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!notice || paused) return;
    const t = setTimeout(onDismiss, UNDO_WINDOW_MS);
    return () => clearTimeout(t);
  }, [notice?.key, paused]);

  // Keyboard shortcut: ⌘Z / Ctrl+Z while the notice is up, unless typing in a field.
  useEffect(() => {
    if (!notice?.canUndo) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable]')) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onUndo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notice, onUndo]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4"
    >
      <AnimatePresence>
        {notice && (
          <motion.div
            key="notice"
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0, transition: transition.enter }}
            exit={{ opacity: 0, y: reduce ? 0 : 4, transition: transition.exit }}
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="pointer-events-auto flex items-center gap-4 rounded-xl border border-line bg-surface py-2.5 pr-2.5 pl-4 text-sm text-ink shadow-sm"
          >
            <span>{notice.message}</span>
            {notice.canUndo && (
              <button
                type="button"
                onClick={onUndo}
                className="rounded-md px-2.5 py-1 font-medium text-accent hover:bg-accent-soft"
              >
                Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
