import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  TaskLockedError,
  TaskOverlapError,
  activeSessionItem,
  addTask,
  deleteTask,
  tasksItem,
  updateTask,
  type TaskDraft,
} from './tasks';
import { dateKey } from './time';

const draft = (start: string, end: string): TaskDraft => ({
  name: 'Write intro',
  why: '  For Friday  ',
  start,
  end,
  allowedSites: ['notion.so'],
});

describe('tasks storage', () => {
  beforeEach(() => fakeBrowser.reset());

  it("adds tasks to today's plan and trims the why", async () => {
    const t = await addTask(draft('09:00', '10:00'));
    expect(t.date).toBe(dateKey());
    expect(t.why).toBe('For Friday');
    expect(await tasksItem.getValue()).toHaveLength(1);
  });

  it('refuses overlapping tasks on the same day', async () => {
    await addTask(draft('09:00', '10:00'));
    await expect(addTask(draft('09:30', '10:30'))).rejects.toBeInstanceOf(TaskOverlapError);
  });

  it('locks the active session task from editing and deleting', async () => {
    const t = await addTask(draft('09:00', '10:00'));
    await activeSessionItem.setValue({ taskId: t.id, startedAt: 0, endsAt: 1, source: 'manual' });
    await expect(updateTask(t.id, draft('11:00', '12:00'))).rejects.toBeInstanceOf(TaskLockedError);
    await expect(deleteTask(t.id)).rejects.toBeInstanceOf(TaskLockedError);
    expect(await tasksItem.getValue()).toHaveLength(1);
  });

  it('unlocks once the session is cleared', async () => {
    const t = await addTask(draft('09:00', '10:00'));
    await activeSessionItem.setValue({ taskId: t.id, startedAt: 0, endsAt: 1, source: 'manual' });
    await activeSessionItem.setValue(null);
    await deleteTask(t.id);
    expect(await tasksItem.getValue()).toHaveLength(0);
  });

  it("migrates dateless v1 tasks to today's date", async () => {
    await fakeBrowser.storage.local.set({
      tasks: [{ id: 'a', name: 'Old', start: '09:00', end: '10:00', allowedSites: ['x.com'], createdAt: 0 }],
    });
    await tasksItem.migrate();
    const [t] = await tasksItem.getValue();
    expect(t?.date).toBe(dateKey());
  });
});
