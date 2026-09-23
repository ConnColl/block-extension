# Block — a focus commitment device for the browser

## What this is
A Chrome extension that does for your computer what a phone Brick does for your phone:
remove temptation before it becomes a distraction.

Each morning the user plans tasks, time blocks, and the websites each task needs.
During a focus session, only those sites are reachable. "Future you" decides what "present you" can access.

Core model: **task-based allowlist**, not a blacklist. During a session, every site not on that task's allowlist is blocked.

This is a portfolio project for a senior UX / motion design role, built in ~24 hours.
It must actually work, and its motion must feel calm, deliberate, and intentional.
When in doubt, cut scope — never ship something half-working.

## Stack
- WXT (Manifest V3 extension framework) + React + TypeScript
- Tailwind CSS
- Motion (`motion/react`) for all UI animation
- `chrome.declarativeNetRequest` dynamic rules for blocking
- `chrome.storage.local` for plans and history
- `chrome.alarms` for session start/end
- `chrome.tabs` for the tab limit

## MVP scope (build only this)
1. **Morning plan** (extension page, opened from the toolbar popup): add tasks with name, start/end time, and allowed websites (domains). Edit and delete tasks.
2. **Focus session**: starts automatically at a task's start time (and can be started manually). While active, all main-frame navigations to non-allowed domains redirect to the Blocked page. Subdomains of an allowed domain are allowed.
3. **Blocked page**: calm intercept. Shows the current task, time remaining, and the allowed sites as links. No shaming language.
4. **Tab limit**: fixed maximum open tabs during a session (default 5). Extra tabs are closed with a gentle in-page notice.
5. **Override**: intentionally slow. Hold a button for 3 seconds, then type a short reason, then the session ends. Log every override with its reason.
6. **Task completion**: at session end, ask "Did you finish?" Mark complete or missed. A task that ends without an answer is marked missed.
7. **Popup**: current task, time remaining, tabs used / limit, and "Open plan".

## Out of scope (roadmap only — do not build)
AI-generated schedules, website suggestions, calendar integration, drag-and-drop rescheduling, analytics dashboards, streaks, distraction reports, tab grouping. These appear in the case study as a roadmap.

## Motion tokens — the ONLY values allowed
Shared with the portfolio's motion system. Define in `lib/motion.ts`. Never hardcode durations or easings.

Durations: `instant` 100ms · `quick` 200ms · `standard` 300ms · `emphasized` 500ms · `deliberate` 3000ms (override hold only)

Easings:
- `standard` cubic-bezier(0.2, 0, 0, 1)
- `enter` cubic-bezier(0, 0, 0, 1)
- `exit` cubic-bezier(0.3, 0, 1, 1)
- `spring` { type: "spring", stiffness: 400, damping: 40 } — no overshoot, ever

## Motion principles for Block
1. **Calm over clever.** A focus tool never competes for attention.
2. **Redirect, don't punish.** Blocking feels like a door gently closing, not an alarm.
3. **Friction is a feature.** The override is the one place motion is deliberately slow. The user should feel the time pass.
4. **Entering focus should feel like a shift.** The session start is the signature moment: noticeable, quiet, and confident.
5. **Closure without guilt.** Completing a task feels good; a missed task is noted neutrally.

## The six signature moments (priority for polish)
1. Adding a task — time block settles into the schedule
2. Entering focus mode
3. Hitting a blocked site
4. Reaching the tab limit
5. The override hold-to-confirm
6. Task complete / missed

## Accessibility — non-negotiable
- Respect `prefers-reduced-motion` (Motion's `useReducedMotion`). The override hold still requires 3 seconds, but shows a progress bar instead of animated effects.
- Everything keyboard-accessible, visible focus states, WCAG AA contrast.

## Design direction
Typography-led, lots of whitespace, one accent color, light and dark mode. Quiet and confident.

## Honesty rules
- Never invent usage data, users, or metrics. Use `[RESULT TBD]` placeholders.
- Block is "inspired by" Brick; never implies affiliation.

## How to work with me
- Before building anything larger than one component, show a short plan and wait for approval.
- Build in small working steps. After each step: type-check, build, and tell me exactly how to reload and test it in Chrome.
- Commit after each working step with a clear message.
- If a Chrome API behaves unexpectedly or a task gets complex, stop and suggest a simpler version.
- Keep `PROCESS_LOG.md`: what I asked, what you built, what went wrong, what I changed.
