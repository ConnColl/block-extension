import { animate } from 'motion/mini';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { upcomingItem, type UpcomingSession } from '@/lib/tasks';
import { formatCountdown } from '@/lib/session';
import { duration, easing } from '@/lib/motion';
import tokens from '@/assets/tokens.css?inline';

/**
 * "Focus begins in 1:00 · Write intro" — a quiet heads-up on every open page a
 * minute before a scheduled session, so people can save their work before
 * tabs outside the task are set aside.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main(ctx) {
    let ui: ReturnType<typeof mount> | null = null;

    const render = (upcoming: UpcomingSession | null) => {
      if (upcoming && upcoming.startsAt > Date.now()) {
        if (ui?.taskId !== upcoming.taskId) {
          ui?.remove();
          ui = mount(upcoming);
        }
      } else {
        ui?.remove();
        ui = null;
      }
    };

    render(await upcomingItem.getValue());
    const unwatch = upcomingItem.watch(render);
    ctx.onInvalidated(() => {
      unwatch();
      ui?.remove(true);
    });
  },
});

const css = `
${tokens}
:host { all: initial; }
.notice {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
  display: flex; align-items: flex-start; gap: 12px;
  max-width: min(360px, calc(100vw - 40px));
  padding: 14px 10px 14px 16px;
  background: var(--surface); color: var(--ink);
  border: 1px solid var(--line); border-radius: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.08);
  font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.title { margin: 0; font-weight: 600; }
.count { font-variant-numeric: tabular-nums; color: var(--accent); }
.body { margin: 2px 0 0; color: var(--muted); }
button {
  all: unset; cursor: pointer; flex: none;
  width: 24px; height: 24px; display: grid; place-items: center;
  border-radius: 6px; color: var(--muted); font-size: 16px; line-height: 1;
}
button:hover { color: var(--ink); background: var(--bg); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;

function mount(upcoming: UpcomingSession) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = document.createElement('block-heads-up');
  const root = host.attachShadow({ mode: 'closed' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [sheet];

  const box = document.createElement('div');
  box.className = 'notice';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');

  const text = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'title';
  const count = document.createElement('span');
  count.className = 'count';
  title.append('Focus begins in ', count, ` · ${upcoming.taskName}`);
  const body = document.createElement('p');
  body.className = 'body';
  body.textContent = 'Save your work. Tabs this task doesn’t need will be set aside.';
  text.append(title, body);

  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Hide this notice');
  close.textContent = '×';

  box.append(text, close);
  root.append(box);
  document.documentElement.append(host);

  const tick = () => (count.textContent = formatCountdown(upcoming.startsAt - Date.now()));
  tick();
  const timer = setInterval(tick, 1000);

  animate(
    box,
    { opacity: [0, 1], transform: reduce ? ['none', 'none'] : ['translateY(8px)', 'translateY(0)'] },
    { duration: duration.standard, ease: easing.enter },
  );

  let removed = false;
  const remove = (immediate = false) => {
    if (removed) return;
    removed = true;
    clearInterval(timer);
    if (immediate) return host.remove();
    animate(box, { opacity: [1, 0] }, { duration: duration.quick, ease: easing.exit }).then(() => host.remove());
  };
  close.addEventListener('click', () => remove());

  return { taskId: upcoming.taskId, remove };
}
