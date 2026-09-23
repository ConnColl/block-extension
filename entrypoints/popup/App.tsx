import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { motion, useReducedMotion } from 'motion/react';
import { tasksItem, type Task } from '@/lib/tasks';
import { transition } from '@/lib/motion';

const PLAN_URL = browser.runtime.getURL('/plan.html');

/** Focus an existing plan tab if there is one; otherwise open a new one. */
async function openPlan() {
  try {
    const [existing] = await browser.runtime.getContexts({
      contextTypes: ['TAB'],
      documentUrls: [PLAN_URL],
    });
    if (existing && existing.tabId >= 0) {
      await browser.tabs.update(existing.tabId, { active: true });
      if (existing.windowId >= 0) await browser.windows.update(existing.windowId, { focused: true });
      window.close();
      return;
    }
  } catch {
    // getContexts unavailable — fall through to opening a new tab.
  }
  await browser.tabs.create({ url: PLAN_URL });
  window.close();
}

export default function App() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    tasksItem.getValue().then(setTasks);
    return tasksItem.watch(setTasks);
  }, []);

  const count = tasks?.length ?? 0;

  return (
    <motion.main
      className="w-72 bg-bg p-5 font-sans text-ink"
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition.enter}
    >
      <h1 className="text-sm font-semibold tracking-tight">Block</h1>
      <p className="mt-3 text-sm text-muted">
        {tasks === null
          ? ' '
          : count === 0
            ? 'No tasks planned yet.'
            : `${count} ${count === 1 ? 'task' : 'tasks'} planned.`}
      </p>
      <button
        type="button"
        onClick={openPlan}
        className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
      >
        Open plan
      </button>
    </motion.main>
  );
}
