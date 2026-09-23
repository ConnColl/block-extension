import { motion } from 'motion/react';
import { transition } from '@/lib/motion';

/** Placeholder until step 5 builds the real override (hold, passes, confession, ad break). */
export default function App() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6 font-sans text-ink">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={transition.enter}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Ending a session early is coming soon.</h1>
        <p className="mt-3 text-base text-muted">For now, your session runs until its end time.</p>
        <button
          type="button"
          onClick={() => history.back()}
          className="mt-8 rounded-lg px-0 py-1 text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          ← Go back
        </button>
      </motion.div>
    </main>
  );
}
