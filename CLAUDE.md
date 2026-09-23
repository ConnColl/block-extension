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
1. **Morning plan** (extension page, opened from the toolbar popup): add tasks with name, start/end time, allowed websites (domains), and an optional one-line "why" (what this task is for). Edit and delete tasks. Typed sites are normalized to bare domains (no protocol, `www` or path). Domains from open tabs are offered as one-click suggestions, and each allowed domain shows its favicon from Chrome's local favicon cache.
2. **Focus session**: starts automatically at a task's start time (and can be started manually). While active, all main-frame navigations to non-allowed domains redirect to the Blocked page. Subdomains of an allowed domain are allowed.
   - **Heads-up:** one minute before a scheduled session, open pages show a gentle notice: "Focus begins in 1:00 · [task name]". It gives people time to save their work before tabs are parked.
   - **Two blocking layers.** The first is a declarativeNetRequest redirect rule. The second watches tab URL changes, to catch pages that load without a network request: pages served by a site's service worker (for example a signed-in Pinterest), pages restored from the back/forward cache, and prerendered pages.
   - **Tab parking:** at session start, open tabs on non-allowed sites are parked on the Blocked page and their URLs are remembered. When the session ends, they're restored. On back-to-back tasks, a tab the next task also disallows stays parked.
3. **Blocked page**: calm intercept. Shows the current task, time remaining, and the allowed sites as links. No shaming language.
4. **Tab limit**: at most 5 tabs *in use* during a session. Parked tabs are paused, not in use, so they don't count. A new tab that would go over is closed. The tab the user was on shows a gentle notice: "5 of 5 tabs in use. Close one to open another." When the closed tab's URL is on the allowlist, the notice offers **Open here instead**, which loads it in the current tab. Tabs Chrome restores in the first 10 seconds after startup aren't closed, and popup windows (e.g. sign-in) don't count.
5. **Override**: intentionally slow, and more costly the more it's used. See **Override design** below.
6. **Task completion**: at session end, ask "Did you finish?" Mark complete or missed. A task that ends without an answer is marked missed.
7. **Popup**: current task, time remaining, tabs in use / limit (plus paused tabs, e.g. "3 of 5 tabs in use · 7 paused"), and "Open plan".

## Override design
The only way to end a session early, or to edit or delete the task in an active session.

1. **Hold to confirm.** Hold a button for 3 seconds (`deliberate` token). Releasing early cancels the override.
2. **Emergency passes.** The user gets 3 passes per week. If one is left, holding spends it and the session ends immediately.
3. **Confession (passes used up).** The user types a confession generated for this attempt: one line picked at random, followed by "[task name] can wait." The lines:
   - "I would like to abandon my potential please."
   - "I am voluntarily entering the scroll hole."
   - "Please return me to the content mines."
   - "I would rather consume content than become the person I said I wanted to be."

   Example: `I am voluntarily entering the scroll hole. Write the case study intro can wait.`
   - A new line is picked at random for each attempt, and it stays the same for the whole attempt.
   - Matching ignores capitalization, punctuation, spaces at the start and end, and repeated spaces between words. Otherwise the words must match, including the task name.
   - The field doesn't accept paste or drag-and-drop.
4. **Unskippable "ad break."** After the confession, a fixed 10-minute ad break plays. The session only ends if the user sits through it.
   - The break is a sequence of short spots, labeled like TV: **"Ad 3 of 12 · Your break begins in 7:42"**. The spot count and lengths add up to exactly 10 minutes.
   - The spots rotate through:
     - the task and its "why" (if one was set);
     - the time remaining in the block;
     - the tasks completed this week (real data only; this spot is left out until task completion exists);
     - a one-minute breathing spot.
   - **"Back to work"** is always available. It cancels the override and returns to the task.
   - Leaving the page resets the countdown: closing the tab, navigating away or reloading starts the break over from Ad 1.
   - The skip area reads exactly: **"Skip unavailable. You set this up for a reason."**
   - When the break finishes, the session ends.
   - **If the session reaches its end time during the break**, the break stops and shows: **"Good news: you made it. Your session is over."** The session ends normally, not as an override.
5. **Logging.** Record every override in `chrome.storage.local` with its time, the task, and the method (`pass` or `confession`), plus the passes left. Back-to-work cancellations are logged as abandoned attempts. A session that ends naturally during the break is logged as `outlasted`, not as an override.
6. **Developer setting.** A toggle that shortens the ad break to 10 seconds total, for testing. It's off by default and clearly labeled as a developer setting.

Weekly reset: passes reset on Monday at 00:00 local time.
The ad-break length, spot sequence and developer length are policy constants, not motion tokens. Keep them in one place (e.g. `lib/override.ts`).

## Business model (for the case study — not for building)
The ad break is ad inventory, but Block protects attention, the antithesis of ads. Selling a user's most vulnerable moment would break the product's promise. Monetization: Block Pro (analytics, calendar sync, AI planning, Mac app) and Block for Teams. The ad break is sponsored only by Morning You.

## Known limitations
- **Browser only.** A Chrome extension can't block other apps or other browsers. Opening Safari, or Pinterest's desktop app, bypasses Block.
- **Incognito** bypasses Block unless the user turns on "Allow in Incognito" for it in `chrome://extensions`.
- **Unsaved work in parked tabs** is lost when the tab is sent to the Blocked page. The mitigation is the one-minute heads-up before scheduled sessions. Manual starts are the user's own choice, so there's no heads-up for them.
- **Chrome quitting mid-session** loses the list of parked tabs, because tab ids don't survive a restart. Those tabs reopen on the Blocked page, which offers "Continue to …" once the session is over.
- **Logins that pass through another domain** are blocked unless that domain is allowed. For example, a Google login goes through `accounts.google.com`.
- **Content embedded inside an allowed site** (iframes) isn't blocked. Only full page loads are.
- **No notice on Chrome's own pages.** Extensions can't draw on `chrome://` pages, including the new tab page. On those pages the tab limit still closes the extra tab, but no notice appears. The same goes for web pages that were already open before Block was installed or reloaded, until they're refreshed.
- **Install warning:** redirecting pages needs host access to all sites, so Chrome warns "Read and change all your data on all websites".

## Out of scope (roadmap only — do not build)
**Block for Mac**: a companion app that extends the same session to other apps and browsers. AI-generated schedules, website suggestions, calendar integration, drag-and-drop rescheduling, analytics dashboards, streaks, distraction reports, tab grouping. These appear in the case study as a roadmap.

## Motion tokens — the ONLY values allowed
Shared with the portfolio's motion system. Define in `lib/motion.ts`. Never hardcode durations or easings.

Durations: `instant` 100ms · `quick` 200ms · `standard` 300ms · `emphasized` 500ms · `deliberate` 3000ms (override hold only)

Easings:
- `standard` cubic-bezier(0.2, 0, 0, 1)
- `enter` cubic-bezier(0, 0, 0, 1)
- `exit` cubic-bezier(0.3, 0, 1, 1)
- `spring` { type: "spring", stiffness: 400, damping: 40 } — no overshoot, ever
- `linear` cubic-bezier(0, 0, 1, 1) — **only** for motion that represents real time passing: the override hold fill and countdown/progress indicators. Never for UI transitions.

## Motion principles for Block
1. **Calm over clever.** A focus tool never competes for attention.
2. **Redirect, don't punish.** Blocking feels like a door gently closing, not an alarm.
3. **Friction, not punishment.** The Blocked page stays gentle. All friction lives in the override, because the user set those rules in advance. The confession is private and self-aware: a little uncomfortable on purpose, never cruel.
4. **Friction is a feature.** The override is the one place motion is deliberately slow. The user should feel the time pass.
5. **Entering focus should feel like a shift.** The session start is the signature moment: noticeable, quiet, and confident.
6. **Closure without guilt.** Completing a task feels good; a missed task is noted neutrally.
7. **Motion that represents real time is linear, so it never misrepresents how long something takes.**

## The six signature moments (priority for polish)
1. Adding a task — time block settles into the schedule
2. Entering focus mode
3. Hitting a blocked site
4. Reaching the tab limit
5. The override hold-to-confirm
6. Task complete / missed

## Accessibility — non-negotiable
- Respect `prefers-reduced-motion` (Motion's `useReducedMotion`). The override hold still requires 3 seconds, but shows a progress bar instead of animated effects. The ad break shows a plain numeric timer, the breathing spot uses text cues ("Breathe in… breathe out") instead of an animated shape, and "Back to work" must be reachable by keyboard at all times.
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
