import { animate } from 'motion/mini';
import { duration, easing } from './motion';
import tokens from '@/assets/tokens.css?inline';

/**
 * Small, quiet in-page notices (the heads-up and the tab limit), rendered into a
 * closed shadow root so page styles can't touch them. Plain DOM + motion/mini so
 * it stays light enough to inject into every page.
 */

const css = `
${tokens}
:host { all: initial; }
.stack {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
  display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
  max-width: min(380px, calc(100vw - 40px));
}
.notice {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 10px 14px 16px;
  background: var(--surface); color: var(--ink);
  border: 1px solid var(--line); border-radius: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.08);
  font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.title { margin: 0; font-weight: 600; }
.accent { font-variant-numeric: tabular-nums; color: var(--accent); }
.body { margin: 2px 0 0; color: var(--muted); }
.meter { display: flex; gap: 4px; margin-top: 8px; }
.dot { width: 6px; height: 6px; border-radius: 999px; background: var(--line); }
.dot.on { background: var(--accent); }
.action {
  all: unset; cursor: pointer; display: inline-block; margin-top: 10px;
  padding: 5px 10px; border-radius: 8px; font-weight: 500;
  color: var(--accent-ink); background: var(--accent);
}
.action:hover { opacity: 0.9; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.actions .action { margin-top: 0; }
.action.secondary { color: var(--ink); background: transparent; box-shadow: inset 0 0 0 1px var(--line); }
.action.secondary:hover { background: var(--bg); opacity: 1; }
.close {
  all: unset; cursor: pointer; flex: none;
  width: 24px; height: 24px; display: grid; place-items: center;
  border-radius: 6px; color: var(--muted); font-size: 16px; line-height: 1;
}
.close:hover { color: var(--ink); background: var(--bg); }
.action:focus-visible, .close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;

let stack: HTMLElement | null = null;

function getStack(): HTMLElement {
  if (stack?.isConnected) return stack;
  const host = document.createElement('block-notices');
  const root = host.attachShadow({ mode: 'closed' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [sheet];
  stack = document.createElement('div');
  stack.className = 'stack';
  root.append(stack);
  document.documentElement.append(host);
  return stack;
}

export interface NoticeOptions {
  /** Title content; strings and elements (e.g. a live countdown span). */
  title: (string | Node)[];
  body?: string;
  /** Filled / total dots, e.g. tabs in use. */
  meter?: { filled: number; total: number };
  action?: { label: string; ariaLabel?: string; onClick: () => void };
  /** Several choices side by side; the first is primary. */
  actions?: { label: string; onClick: () => void }[];
  closeLabel: string;
  /** Auto-hide after this long; the timer pauses while hovered or focused. */
  autoHideMs?: number;
}

export interface Notice {
  remove: (immediate?: boolean) => void;
}

export function showNotice(opts: NoticeOptions): Notice {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const box = document.createElement('div');
  box.className = 'notice';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');

  const text = document.createElement('div');
  const title = document.createElement('p');
  title.className = 'title';
  title.append(...opts.title);
  text.append(title);

  if (opts.body) {
    const body = document.createElement('p');
    body.className = 'body';
    body.textContent = opts.body;
    text.append(body);
  }

  if (opts.meter) {
    const meter = document.createElement('div');
    meter.className = 'meter';
    meter.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < opts.meter.total; i++) {
      const dot = document.createElement('span');
      dot.className = i < opts.meter.filled ? 'dot on' : 'dot';
      meter.append(dot);
    }
    text.append(meter);
  }

  if (opts.action) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'action';
    action.textContent = opts.action.label;
    if (opts.action.ariaLabel) action.setAttribute('aria-label', opts.action.ariaLabel);
    action.addEventListener('click', () => {
      opts.action!.onClick();
      remove();
    });
    text.append(action);
  }

  if (opts.actions?.length) {
    const row = document.createElement('div');
    row.className = 'actions';
    opts.actions.forEach((a, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = i === 0 ? 'action' : 'action secondary';
      btn.textContent = a.label;
      btn.addEventListener('click', () => {
        a.onClick();
        remove();
      });
      row.append(btn);
    });
    text.append(row);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.setAttribute('aria-label', opts.closeLabel);
  close.textContent = '×';

  box.append(text, close);
  getStack().append(box);

  animate(
    box,
    { opacity: [0, 1], transform: reduce ? ['none', 'none'] : ['translateY(8px)', 'translateY(0)'] },
    { duration: duration.standard, ease: easing.enter },
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const startTimer = () => {
    if (opts.autoHideMs) timer = setTimeout(() => remove(), opts.autoHideMs);
  };
  const stopTimer = () => clearTimeout(timer);
  box.addEventListener('pointerenter', stopTimer);
  box.addEventListener('pointerleave', startTimer);
  box.addEventListener('focusin', stopTimer);
  box.addEventListener('focusout', startTimer);
  startTimer();

  let removed = false;
  function remove(immediate = false) {
    if (removed) return;
    removed = true;
    stopTimer();
    if (immediate) return box.remove();
    animate(box, { opacity: [1, 0] }, { duration: duration.quick, ease: easing.exit }).then(() => box.remove());
  }
  close.addEventListener('click', () => remove());

  return { remove };
}
