import { storage } from 'wxt/utils/storage';
import { activeSessionItem, sortTasks, tasksItem, type Task } from './tasks';
import { outcomesItem, weekStartKey, type TaskOutcome } from './override';
import { dateKey, timeOnDate, toMinutes } from './time';
import { findOverlap } from './tasks';

export interface DevSettings {
  /** Ad break lasts 10 seconds instead of 10 minutes. */
  shortAdBreak: boolean;
}

export const devSettingsItem = storage.defineItem<DevSettings>('local:devSettings', {
  fallback: { shortAdBreak: false },
});

const SAMPLE_TASKS: Pick<Task, 'name' | 'why' | 'start' | 'end' | 'allowedSites'>[] = [
  { name: 'Draft the case study outline', why: 'So Friday’s review has something real', start: '09:00', end: '10:00', allowedSites: ['notion.so'] },
  { name: 'Motion spec for the hold', start: '10:30', end: '11:30', allowedSites: ['figma.com'] },
  { name: 'Reply to Maya', start: '08:30', end: '09:00', allowedSites: ['mail.google.com'] },
  { name: 'Prototype the Blocked page', why: 'Calm, not punishing', start: '13:00', end: '14:30', allowedSites: ['figma.com', 'github.com'] },
  { name: 'Record the demo video', start: '08:00', end: '08:45', allowedSites: ['loom.com'] },
];

/**
 * Sample data for demos: completed tasks earlier this week (or earlier today on a
 * Monday), each marked `sample` so the UI can label them. Never touches real tasks.
 */
export async function fillSampleData(now = Date.now()) {
  const tasks = await tasksItem.getValue();
  const outcomes = await outcomesItem.getValue();
  const monday = timeOnDate(weekStartKey(now), '00:00');
  const today = dateKey(new Date(now));
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();

  // Days from Monday up to today.
  const days: string[] = [];
  for (let d = new Date(monday); dateKey(d) <= today; d.setDate(d.getDate() + 1)) days.push(dateKey(d));

  const added: Task[] = [];
  const addedOutcomes: Record<string, TaskOutcome> = {};
  SAMPLE_TASKS.forEach((s, i) => {
    // Spread across earlier days; fall back to today if it's early in the week.
    const date = days.length > 1 ? days[i % (days.length - 1)]! : today;
    if (date === today && toMinutes(s.end) > nowMin) return; // only tasks already over
    const sameDay = [...tasks, ...added].filter((t) => t.date === date);
    if (findOverlap(s, sameDay)) return;
    const task: Task = { ...s, id: crypto.randomUUID(), date, createdAt: now, sample: true };
    added.push(task);
    addedOutcomes[task.id] = { outcome: 'completed', at: timeOnDate(date, s.end) };
  });

  await tasksItem.setValue(sortTasks([...tasks, ...added]));
  await outcomesItem.setValue({ ...outcomes, ...addedOutcomes });
  return added.length;
}

export async function clearSampleData() {
  const tasks = await tasksItem.getValue();
  const session = await activeSessionItem.getValue();
  const sampleIds = new Set(tasks.filter((t) => t.sample && t.id !== session?.taskId).map((t) => t.id));
  const outcomes = await outcomesItem.getValue();
  await tasksItem.setValue(tasks.filter((t) => !sampleIds.has(t.id)));
  await outcomesItem.setValue(Object.fromEntries(Object.entries(outcomes).filter(([id]) => !sampleIds.has(id))));
  return sampleIds.size;
}
