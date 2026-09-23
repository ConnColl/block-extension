# Process log

What I asked, what was built, what went wrong, what I changed. Newest entries at the bottom.

---

## 2026-09-22 — Step 1: Setup + Morning Plan

### What I asked
Set up the Block extension (WXT + React + TypeScript + Tailwind + Motion), create `lib/motion.ts` with the motion tokens, and build step 1 only: the Morning Plan page where tasks can be added, edited, and deleted (name, start/end time, allowed websites), saved to `chrome.storage.local`. A simple toolbar popup that opens the plan. Init git and this log. Show the plan first.

After reviewing the plan I changed two things:
- **Delete → immediate removal + ~5s undo notice**, instead of a confirmation dialog.
- **Step 2 constraint:** once sessions exist, the task in an active session must be locked from editing or deleting, except through the override. Structure the data for that now.

### What was built
- **Scaffold:** WXT 0.21 (MV3), React 19, TypeScript, Tailwind v4 via `@tailwindcss/vite`, `motion`. Manifest permission: `storage` only. Later permissions are added in the step that needs them.
- **`lib/motion.ts`:** the only timing values in the app. Durations (ms and s), `standard`/`enter`/`exit` easings, the no-overshoot `spring`, and preset transitions built from those.
- **`lib/tasks.ts`:** the `Task` model, `chrome.storage.local` items (`tasks`, `activeSession`), validation, add/update/delete/restore.
- **`lib/domains.ts`:** turns `https://www.Notion.so/page` into `notion.so` and rejects entries that aren't domains.
- **Morning Plan page** (`plan.html`):
  - An add form that suggests the next free hour as the default time.
  - A schedule sorted by start time, with inline editing.
  - Calm inline validation: a name is required, the end must be after the start, at least one site is required, and tasks can't overlap.
- **Popup:** a task count and an **Open plan** button. If a plan tab is already open, the button focuses it instead of opening a duplicate.
- **Motion:**
  - **Signature moment 1:** a new task enters with the `spring` token and siblings reflow with a layout animation. Its time marker lands in the accent colour and fades to neutral over `emphasized`, so it "settles into the schedule".
  - Deleting a task uses the `exit` easing.
  - With reduced motion on, rows only fade and there are no position or layout animations.
- **Accessibility:**
  - Every field has a label, errors are linked with `aria-describedby` and `aria-invalid`, and focus rings are visible.
  - Escape cancels an edit.
  - Focus returns to the row's Edit button after an edit. After a delete, it moves to the list heading.
  - The undo notice is a polite live region.

### Decision: undo instead of confirm on delete
**What:** Delete removes the task immediately and shows "Deleted '…' — Undo" for 5 seconds. The timer pauses while the pointer or keyboard focus is on the notice. ⌘Z/Ctrl+Z also undoes, unless you're typing in a field. Undo puts the task back in its time slot with the same settle animation. If a new task has taken that slot in the meantime, the notice explains why the task can't be restored, rather than creating an overlap.
**Why:**
- A confirmation dialog interrupts every delete to guard against the rare mistake. Undo keeps the common case fast and still makes mistakes recoverable.
- It fits "calm over clever": no modal and no alarm.
- Pausing on hover or focus means keyboard and screen-reader users aren't racing the 5-second window, which covers WCAG 2.2.1 Timing Adjustable.
- The 5 seconds is a reading window, not an animation, so it lives in `lib/tasks.ts` as `UNDO_WINDOW_MS`, not in the motion tokens.

### Decision: data shape for the step-2 lock
**What:** A session is stored separately from tasks, as `activeSession: { taskId, startedAt, endsAt } | null` in `chrome.storage.local`, and refers to its task by id. `isTaskLocked(taskId, session)` is the single check. `updateTask` and `deleteTask` both throw `TaskLockedError` when the task is locked. The UI already swaps Edit/Delete for an "In session" label and leaves edit mode if a task becomes locked while it's open.
**Why:**
- **One source of truth.** A `locked` flag on each task could drift out of sync with the real session, for example after a crash or an alarm that never fired. Here the task is locked exactly when it's the active session's task, so the two can't disagree.
- **Enforced at the data layer, not only the UI.** A second plan tab, the popup or a future caller can't get around the lock, because the storage functions refuse the change.
- **Tasks stay untouched.** Starting or ending a session never rewrites the task list, so storage-change listeners don't fire needlessly.
- **The override is the only way out.** Step 2's override will end the session by clearing `activeSession`, which unlocks the task automatically. There's no separate "unlock" path to guard.

In step 1, nothing writes `activeSession`, so no task is ever locked yet.

### Other decisions
- Tasks aren't tied to a date yet. There's one list, which is the simplest option for step 1. Resetting it each day can come later.
- A task can't cross midnight, and times are stored as local `HH:MM`.
- Tasks can't overlap. Only one focus session can run at a time, so overlapping tasks would be ambiguous. This is also checked again inside `addTask`/`updateTask`, so two open plan tabs can't create an overlap.

### What went wrong
- The folder wasn't empty, and WXT's setup tool expects an empty one, so the project was set up by hand.
- `wxt prepare` fails until at least one entrypoint exists. The entrypoints were written first, then it ran.
- WXT's generated tsconfig enables `noUncheckedIndexedAccess`, which caught four array-destructuring spots. Fixed with defaults.
- npm installed TypeScript 7.0. The type check runs cleanly with it.

### Not yet verified
- Tested: type check, production build, and domain cleanup against sample inputs.
- **Not yet clicked through in Chrome.** Manual test pending.

---

## 2026-09-22 — Plan change: override redesign (not built yet)

### What I asked
Replace the simple "hold 3s, then type a reason" override with a stronger design:
- Hold to confirm for 3 seconds.
- 3 emergency passes per week. Spending a pass ends the session.
- When the passes run out, type the confession exactly: "I am choosing distraction over [task name]".
- Then an unskippable "ad" countdown showing the task name, the "why" and the time remaining. It escalates from 60s to 120s to 180s for the rest of the week.
- "Back to work" is always available. Leaving the page resets the countdown. The skip area reads "Skip unavailable. You set this up for a reason."
- Add an optional one-line "why" field to each task.
- Log every override.

This is a plan change only. `CLAUDE.md` is updated, and there's no code yet.

### What changed in CLAUDE.md
- MVP item 1 now includes the optional "why".
- MVP item 5 points to a new **Override design** section.
- The accessibility section now covers the countdown.

### Details I filled in (open to change)
- **Week:** passes and escalation reset on Monday at 00:00 local time.
- **Confession field:** paste is blocked, and the task name must match exactly.
- **Logging:** abandoned attempts ("Back to work") are logged alongside completed overrides.
- **Where the constants live:** the 60/120/180s ad lengths are policy constants in `lib/override.ts`, not motion tokens.

### Tension to resolve
- The confession and the ad are deliberately punitive. That's at odds with the motion principle "Redirect, don't punish" and with "No shaming language" on the Blocked page.
- A proposed way to reconcile them: the Blocked page stays gentle, and friction is concentrated only in the override, which the user chose in advance ("Future you decides").
- The case study should state this explicitly as a design decision.

### Effect on existing code
- `Task` will gain an optional `why?: string`. It's optional, so tasks already saved don't need to be migrated.
- Step 1's lock design already assumes the override is the only way out, so no change is needed there.

---

## 2026-09-22 — Plan change: friction principle + forgiving confession match

### What I asked
- Resolve the tension noted in the previous entry by adding this principle to CLAUDE.md: "Friction, not punishment. The Blocked page stays gentle. All friction lives in the override, because the user set those rules in advance. The confession is private and states a fact in the user's own words; it never insults."
- Make the confession match forgiving of capitalization and extra spaces, but keep paste disabled.

### What changed in CLAUDE.md
- The new principle is #3 under "Motion principles for Block", placed right after "Redirect, don't punish". The principles after it are renumbered.
- The confession match now ignores capitalization, spaces at the start and end, and repeated spaces between words. Otherwise the words must match, including the task name. Paste is still blocked.

### Why
- The friction should come from the effort of typing the sentence out yourself, not from tripping over a capital letter or a double space.
- A retype forced by formatting feels like a gotcha, which is punishment, not friction.
- Keeping paste blocked keeps the part that matters: you have to write the sentence yourself.

This supersedes the "task name must match exactly" detail in the previous entry. There's no code change yet.

---

## 2026-09-22 — Step 2 planned, awaiting approval (paused for the night)

### What I asked
Build step 2: focus sessions and blocking.
- A session starts at a task's start time or manually, and ends at the task's end time.
- During a session, main-frame navigations to non-allowed domains redirect to a placeholder Blocked page via declarativeNetRequest dynamic rules. Subdomains of allowed domains are allowed.
- Lock the active task from editing and deleting.
- The popup shows the current task and time remaining.
- Plan first, and a test checklist when done.

### Proposed plan (not approved yet — nothing built)

**Permissions**
- Add `declarativeNetRequest`, `alarms`, and host permission `<all_urls>`.
- Redirecting a page requires host access to that site. Without it, the only option is a plain block, which shows Chrome's error page instead of ours.
- Cost: Chrome shows a "Read and change all your data on all websites" warning at install.

**Blocking**
- One dynamic rule while a session is active: `main_frame` + `urlFilter: '|http'`, redirecting to `extensionPath: '/blocked.html'`.
- The allowed sites go in `excludedRequestDomains`, which covers subdomains automatically.
- `blocked.html` must be web-accessible so the redirect can load it.
- The rule is removed when the session ends.

**Background** (`entrypoints/background.ts`)
- It's the only thing that writes the session. The plan page and popup ask it by message.
- **Scheduled start:** an alarm for each of today's tasks at its start time, rescheduled whenever tasks change.
- **End:** an alarm at `endsAt` clears the session and removes the rule.
- **Manual start ("Start now"):** only when no session is running and the task hasn't ended. The session still ends at the task's end time.
- **Missed start:** if Chrome was closed at a task's start time and opens during that task, the session starts then (on `runtime.onStartup`). A task added or edited while its time slot is already running doesn't start by itself.
- **Safety check on startup and install:** if `endsAt` has passed, clear the session and remove the rule, so blocking can never outlive a session.
- **Tabs already open when a session starts:** any tab on a non-allowed http(s) site is sent to the Blocked page. The rule only catches new page loads, so without this an already-open site would stay usable. Trade-off: unsaved work in those tabs is lost.

**Data and logic**
- `activeSession` becomes `{ taskId, startedAt, endsAt, source: 'scheduled' | 'manual' }`.
- `lib/session.ts` holds the pure logic: which task is due now, today's timestamp for an "HH:MM" time, the rule builder, and time remaining.

**Pages**
- **Plan page:** the active task shows "In session · N min left". The other tasks get **Start now**.
- **Popup:** during a session, the current task, a live time remaining and the allowed sites. Otherwise, the next task. Open plan stays.
- **Blocked page (placeholder):** task name, time remaining, and the allowed sites as links. If no session is running, it says so. Polish is step 3.
- **Motion:** simple fades using the tokens only. "Entering focus" polish comes later.

**Checks:** type check, build, and Node tests of the "which task is due now" logic and the rule builder against edge cases (midnight, exact start and end minute, no tasks).

**Known limitations to note, not solve**
- Logins that bounce through another domain (e.g. `accounts.google.com`) need that domain allowed.
- Content embedded inside an allowed site (iframes) isn't blocked.

### Open decision (answer before building)
Step-1 tasks have no date, so a 9:00 task would start **every day** until deleted.
- **A (recommended):** add a `date` to tasks. New tasks belong to today, existing ones become today's on first load, and the plan page shows and schedules only today's tasks.
- **B:** keep tasks repeating daily and revisit at step 6.

### To resume
Reply "go" with A or B (or changes) and step 2 gets built from this plan.

---

## 2026-09-23 — Plan change: override becomes a 10-minute "ad break"

### What I asked
- Keep the 3-second hold, the 3 emergency passes per week and the confession sentence.
- Replace the 60/120/180s escalation with a fixed 10-minute unskippable "ad break". It's a sequence of short spots:
  - the task and its why;
  - time remaining in the block;
  - tasks completed this week;
  - a one-minute breathing spot.
- The spots are labeled like TV: "Ad 3 of 12 · Your break begins in 7:42".
- "Back to work" is always available, and leaving the page resets the countdown.
- If the session ends during the break: "Good news: you made it. Your session is over."
- A developer setting shortens the break to 10 seconds for testing.
- Plan only; don't build yet.

### What changed in CLAUDE.md
The Override design section is rewritten. Details I filled in:
- **Tasks completed this week:** this spot uses real data only, and it's left out until task completion (step 6) exists. This follows the honesty rules.
- **A session that runs out during the break** ends normally, not as an override, and is logged as `outlasted`.
- **The escalation level no longer exists**, so it's removed from logging and from the weekly reset.
- **Reduced motion:** the breathing spot uses text cues instead of an animated shape.

---

## 2026-09-23 — Step 2: Focus sessions and blocking

### What I asked
Build step 2 from the plan logged on 2026-09-22, with two changes:
- **Option A:** tasks get a date.
- **The optional "why" field** is included in this step.

### What was built
- **Dated tasks.** Each task has a `date` ("YYYY-MM-DD", local).
  - New tasks belong to today, and the plan page shows only today's tasks.
  - Only today's tasks can start, and overlap checks compare tasks on the same day only.
  - A storage migration (tasks v1 → v2) gives existing dateless tasks today's date.
- **"Why" field.** An optional one line of up to 120 characters, with the hint "One line, for future you." It shows under the task name on the plan page, in the popup and on the Blocked page.
- **Blocking** (`lib/session.ts` → `buildBlockRule`). One dynamic declarativeNetRequest rule:
  - It matches `main_frame` requests for `^https?://.*`.
  - It redirects them via `regexSubstitution` to `blocked.html#<original URL>`.
  - The allowed sites go in `excludedRequestDomains`, which covers subdomains automatically.
  - Because the original URL rides along, the Blocked page can offer "Continue to …" once the session ends.
- **Background worker** (`entrypoints/background.ts`). It's the only code that writes the session, and all its work runs one operation at a time.
  - **Scheduled start:** an alarm per task that starts later today.
  - **End:** an alarm at `endsAt`.
  - **Manual start:** by message from the plan page.
  - **Missed-start catch-up:** runs on Chrome startup and on install/reload.
  - **Reconcile:** each time the worker wakes, it ends expired sessions, removes stale rules and re-asserts the rule for a live session.
  - **Tab sweep:** tabs already open on non-allowed sites are sent to the Blocked page when a session starts.
- **Plan page:**
  - The active task shows "In session · N min left" and a "Locked" chip. Its Edit and Delete buttons are removed, and the storage layer also refuses the change.
  - Other tasks show **Start now** when no session is running and the task hasn't ended.
- **Popup:** during a session, an "In focus" view with the task, the why, a live time remaining, the end time and the allowed sites. Otherwise, the next task and its start time.
- **Blocked page (placeholder):**
  - During a session it shows "<site> isn't part of this task.", the task, the why, the time remaining and the allowed sites as links.
  - After the session it shows "Your session is over." with a Continue link.
- **Permissions:** `storage`, `alarms`, `declarativeNetRequest`, host `<all_urls>`, and `blocked.html` as web-accessible.
- **Tests:** Vitest with WXT's fake browser. `npm test` runs 18 tests.
  - The "which task is due now" logic, including the exact start and end minute, other days, midnight and no tasks.
  - `canStart`, session expiry, the domain allow-matching (look-alike domains are rejected), the tab-sweep filter, the rule shape and the time formatting.
  - The lock and unlock at the storage layer, the overlap guard and the v1→v2 migration.

### Verified in a real Chrome (Chrome for Testing via Puppeteer, headless)
- **Manual start works.** A second start while one is running is refused: "A focus session is already running."
- **The tab sweep works:** an already-open `example.net` tab moved to the Blocked page.
- **Redirecting works:**
  - `https://example.com/some/path?q=1` → `blocked.html#https://example.com/some/path?q=1`
  - `www.example.org` and `example.org` (the allowed site) load normally.
- **The Blocked page, popup and plan page** all show the task, the why and the time remaining. The active task has no Edit, Delete or Start buttons.
- **End alarm plus scheduled start on the same minute:**
  - Task 1 ended at 09:31, and task 2's start alarm fired at 09:31.
  - The session switched to task 2 (`source: scheduled`), and the allowed site switched with it: `example.com` now loads and `example.org` is blocked.
- **Forced expiry:** the session cleared and no dynamic rules were left. `example.net` loads again, and the Blocked page switches to "Your session is over" with a working Continue link.

The e2e scripts live in the session scratchpad, not the repo, because they need a ~150 MB Chrome download.

### What went wrong
- **Headless e2e artifact:** a Blocked page in a *hidden* tab kept showing the old session after it ended.
  - Cause: hidden tabs don't run animation frames, so the Motion exit animation never finished.
  - Once the tab was brought to the front, it updated correctly. There's no real-world impact, because you see the page as soon as you switch to it.
- **Refactor:** `toMinutes` and `ActiveSession` moved out of `lib/tasks.ts`, into `lib/time.ts` and `lib/session.ts`, so the session logic has no browser dependencies and can be unit-tested. `tasks.ts` re-exports both.

### Known limitations (noted, not solved)
- **Logins that bounce through another domain** are blocked unless that domain is allowed. For example, a Google login goes through `accounts.google.com`, so you'd allow `google.com`.
- **Iframes and embedded content** inside an allowed site aren't blocked. Only full page loads are.
- **The tab sweep replaces the page,** so unsaved work in a swept tab is lost.
- **Install warning:** `<all_urls>` makes Chrome show "Read and change all your data on all websites". Redirecting instead of just blocking requires it.
- **No way to end a session early yet.** That's the override (step 5). Until then, a running session can only end at its end time.
- **Past tasks aren't marked** complete or missed yet (step 6). They simply lose their Start button.
