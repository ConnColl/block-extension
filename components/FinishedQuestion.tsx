import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { send } from '@/lib/messages';
import { transition } from '@/lib/motion';
import { CheckMark } from './CheckMark';

/**
 * "Did you finish?" after a session ends on its own. Either answer is fine:
 * completed gets a quiet check; missed is simply noted.
 */
export function FinishedQuestion({ taskId, taskName, compact }: { taskId: string; taskName: string; compact?: boolean }) {
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);

  async function reply(finished: boolean) {
    setAnswer(finished ? 'yes' : 'no');
    await send({ type: 'task/answer', taskId, finished });
  }

  return (
    <div aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {answer === null ? (
          <motion.div key="ask" exit={{ opacity: 0, transition: transition.exit }}>
            <p className={compact ? 'text-sm' : 'text-base'}>
              Did you finish <span className="font-medium">“{taskName}”</span>?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => reply(true)}
                className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
              >
                Yes, finished
              </button>
              <button
                type="button"
                onClick={() => reply(false)}
                className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium transition-colors hover:bg-surface"
              >
                Not this time
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="answered"
            className="flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: transition.enter }}
          >
            {answer === 'yes' && <CheckMark size={compact ? 28 : 36} />}
            <p className={compact ? 'text-sm' : 'text-base'}>
              {answer === 'yes' ? 'Done. Nicely finished.' : 'Noted. It happens.'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
