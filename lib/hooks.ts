import { useEffect, useState } from 'react';
import { activeSessionItem, tasksItem, type Task } from './tasks';
import { liveSession, type ActiveSession } from './session';

/** Clock-tick interval for countdowns. A refresh rate, not a motion value. */
const TICK_MS = 1000;

/** Current time, re-rendering once a second. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Tasks and the active session from storage, kept live. `null` until loaded. */
export function useBlockState(): { tasks: Task[] | null; session: ActiveSession | null; loaded: boolean } {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    tasksItem.getValue().then(setTasks);
    activeSessionItem.getValue().then((s) => {
      setSession(s);
      setSessionLoaded(true);
    });
    const unwatchTasks = tasksItem.watch(setTasks);
    const unwatchSession = activeSessionItem.watch(setSession);
    return () => {
      unwatchTasks();
      unwatchSession();
    };
  }, []);

  return { tasks, session, loaded: tasks !== null && sessionLoaded };
}

/** The active session and its task, treating a session past its end time as over. */
export function useFocus(now: number) {
  const state = useBlockState();
  const session = liveSession(state.session, now);
  const task = session ? state.tasks?.find((t) => t.id === session.taskId) : undefined;
  return { ...state, session: task ? session : null, task };
}
