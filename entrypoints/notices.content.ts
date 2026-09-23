import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { upcomingItem, type UpcomingSession } from '@/lib/tasks';
import { formatCountdown } from '@/lib/session';
import { showNotice, type Notice } from '@/lib/notice';
import { showTabLimitNotice } from '@/lib/tabLimitNotice';
import type { TabLimitNotice } from '@/lib/tabs';
import { copy } from '@/lib/copy';

/**
 * Block's quiet in-page notices on web pages:
 * - the heads-up, a minute before a scheduled session, so people can save their work;
 * - the tab limit, when a new tab was closed for going over.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main(ctx) {
    let headsUp: { taskId: string; notice: Notice; timer: ReturnType<typeof setInterval> } | null = null;

    const clearHeadsUp = (immediate = false) => {
      if (!headsUp) return;
      clearInterval(headsUp.timer);
      headsUp.notice.remove(immediate);
      headsUp = null;
    };

    const renderHeadsUp = (upcoming: UpcomingSession | null) => {
      if (!upcoming || upcoming.startsAt <= Date.now()) return clearHeadsUp();
      if (headsUp?.taskId === upcoming.taskId) return;
      clearHeadsUp(true);
      const count = document.createElement('span');
      count.className = 'accent';
      const tick = () => (count.textContent = formatCountdown(upcoming.startsAt - Date.now()));
      tick();
      headsUp = {
        taskId: upcoming.taskId,
        timer: setInterval(tick, 1000),
        notice: showNotice({
          title: [copy.headsUpLead, count, '.'],
          body: copy.headsUpBody,
          closeLabel: 'Hide this notice',
        }),
      };
    };

    renderHeadsUp(await upcomingItem.getValue());
    const unwatch = upcomingItem.watch(renderHeadsUp);

    type SessionEnded = { type: 'notice/session-ended'; taskId: string; taskName: string };
    const onMessage = (msg: TabLimitNotice | SessionEnded) => {
      if (msg?.type === 'notice/tab-limit') showTabLimitNotice(msg);
      if (msg?.type === 'notice/session-ended') {
        // Closure without guilt: a warm question, either answer is fine.
        const answer = (finished: boolean) =>
          void browser.runtime.sendMessage({ type: 'task/answer', taskId: msg.taskId, finished }).catch(() => {});
        showNotice({
          title: [copy.welcomeTitle],
          body: `Did you finish “${msg.taskName}”?`,
          actions: [
            { label: 'Yes, finished', onClick: () => answer(true) },
            { label: 'Not this time', onClick: () => answer(false) },
          ],
          closeLabel: 'Answer later',
        });
      }
    };
    browser.runtime.onMessage.addListener(onMessage);

    ctx.onInvalidated(() => {
      unwatch();
      browser.runtime.onMessage.removeListener(onMessage);
      clearHeadsUp(true);
    });
  },
});
