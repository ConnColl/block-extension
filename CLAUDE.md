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
1. **Morning plan** (extension page, opened from the toolbar popup): add tasks with name, start/end time, allowed websites (domains), and an optional one-line "why" (what this task is for). Edit and delete tasks.
2. **Focus session**: starts automatically at a task's start time (and can be started manually). While active, all main-frame navigations to non-allowed domains redirect to the Blocked page. Subdomains of an allowed domain are allowed.
3. **Blocked page**: calm intercept. Shows the current task, time remaining, and the allowed sites as links. No shaming language.
4. **Tab limit**: fixed maximum open tabs during a session (default 5). Extra tabs are closed with a gentle in-page notice.
5. **Override**: intentionally slow, and more costly the more it's used. See **Override design** below.
6. **Task completion**: at session end, ask "Did you finish?" Mark complete or missed. A task that ends without an answer is marked missed.
7. **Popup**: current task, time remaining, tabs used / limit, and "Open plan".

## Override design
The only way to end a session early, or to edit or delete the task in an active session.

1. **Hold to confirm.** Hold a button for 3 seconds (`deliberate` token). Releasing early cancels the override.
2. **Emergency passes.** The user gets 3 passes per week. If one is left, holding spends it and the session ends immediately.
3. **Confession (passes used up).** The user must type this sentence exactly, generated from the task: `I am choosing distraction over [task name]`. The field doesn't accept paste. Matching ignores capitalization, spaces at the start and end, and repeated spaces between words. Otherwise the words must match exactly, including the task name.
4. **Unskippable "ad" countdown.** After the confession, a countdown plays. It shows the task name, the task's "why" (if one was set) and the time left in the session.
   - Length escalates across the week: the first confession-override is 60s, the second is 120s, and every one after that is 180s until the weekly reset.
   - **"Back to work"** is always available. It cancels the override and returns to the task.
   - Leaving the page resets the countdown: closing the tab, navigating away or reloading starts the ad over at its full length.
   - The skip area reads exactly: **"Skip unavailable. You set this up for a reason."**
   - When the countdown finishes, the session ends.
5. **Logging.** Record every override in `chrome.storage.local` with its time, the task, the method (`pass` or `confession`) and the ad length. Also record the passes left and the escalation level. Back-to-work cancellations are logged as abandoned attempts.

Weekly reset: passes and the escalation level reset on Monday at 00:00 local time.
The ad lengths (60/120/180s) are policy constants, not motion tokens. Keep them in one place (e.g. `lib/override.ts`).

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
3. **Friction, not punishment.** The Blocked page stays gentle. All friction lives in the override, because the user set those rules in advance. The confession is private and states a fact in the user's own words; it never insults.
4. **Friction is a feature.** The override is the one place motion is deliberately slow. The user should feel the time pass.
5. **Entering focus should feel like a shift.** The session start is the signature moment: noticeable, quiet, and confident.
6. **Closure without guilt.** Completing a task feels good; a missed task is noted neutrally.

## The six signature moments (priority for polish)
1. Adding a task — time block settles into the schedule
2. Entering focus mode
3. Hitting a blocked site
4. Reaching the tab limit
5. The override hold-to-confirm
6. Task complete / missed

## Accessibility — non-negotiable
- Respect `prefers-reduced-motion` (Motion's `useReducedMotion`). The override hold still requires 3 seconds, but shows a progress bar instead of animated effects. The ad countdown shows a plain numeric timer, and "Back to work" must be reachable by keyboard at all times.
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
