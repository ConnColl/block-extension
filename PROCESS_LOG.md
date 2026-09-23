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

---

## 2026-09-23 — Step 2.1: Closing blocking gaps and improving site entry

### What I asked
Testing found issues, and I asked for:
1. **Pinterest wasn't blocked.** Add a second layer that watches tab URL changes and redirects disallowed URLs.
2. **Park tabs:** on session start, park disallowed tabs and remember their URLs; restore them when the session ends.
3. **Full screen** on session start.
4. **Morning Plan site entry:**
   - normalize typed sites to bare domains;
   - suggest domains from open tabs as one-click chips;
   - show favicons.
5. **CLAUDE.md:** add a Known limitations section (other apps and browsers, Incognito) and a "Block for Mac" roadmap item.

After the plan:
- **It wasn't Incognito.**
- **Full screen** applies to scheduled starts too.
- **Heads-up:** show a one-minute notice before any scheduled session ("Focus begins in 1:00 · [task name]"), as the mitigation for losing unsaved work in parked tabs.

### What went wrong: why Pinterest got through
- **Not reproduced with Pinterest itself.** In the test Chrome, Pinterest was blocked in every case: fresh load, another path, Back button. That test browser was signed out, though, and Pinterest never installed its service worker there.
- **Reproduced with a local test site that installs a service worker** serving its own pages. Mid-session, a navigation to that site **loaded normally, bypassing the declarativeNetRequest redirect**. Pages a service worker serves never reach the network layer the rule watches. A signed-in Pinterest uses a service worker, which is the most likely cause of what I saw.
- **Fix:** a second layer (below). Verified: the same service-worker page is now sent to the Blocked page.

### What was built
- **Second blocking layer** (background, `tabs.onUpdated` + `tabs.onReplaced`).
  - During a session, any tab whose URL changes to a non-allowed http(s) site is sent to the Blocked page.
  - This covers pages served by a service worker, pages restored from the back/forward cache, and prerendered pages.
  - It uses `tabs.onUpdated` rather than `webNavigation`, because the existing host access already exposes tab URLs, so there's no extra install warning.
- **Tab parking and restore.**
  - At session start, disallowed tabs go to `blocked.html#<url>`. `tabId → url` is saved in `storage.session`, since tab ids only last as long as Chrome is running.
  - At the end, each tab still on the Blocked page goes back to its URL.
  - On back-to-back tasks, `planRestore` restores the tabs the next task allows and keeps the rest parked.
  - Closed tabs are forgotten.
  - Tabs blocked *during* a session aren't auto-restored; they keep the "Continue to …" link.
- **Full screen.**
  - On any session start, the last-focused normal window goes full screen. Its previous state is saved, and a back-to-back handover keeps the original.
  - At the end the window returns to that state, but only if it's still full screen. If the user left full screen, Block leaves the window alone.
- **Heads-up.**
  - The background keeps `upcoming` (the next scheduled task starting within `HEADS_UP_MS` = 60s) in `chrome.storage.local`. A heads-up alarm fires 60s before each start, and every reconcile recomputes it.
  - A content script on every page shows a small notice in a closed shadow root, animated with `motion/mini` and the motion tokens:
    - text: "Focus begins in 0:55 · Write intro";
    - hint: "Save your work. Tabs this task doesn't need will be set aside.";
    - a dismiss ×.
  - It fades only when reduced motion is on.
  - The plan row and the popup show the same countdown.
  - It isn't shown for manual starts.
- **Site entry.**
  - Site cleanup was already in place, and there are now more tests for it: pasted full URLs, ports, subdomains kept, invalid entries rejected.
  - **"From your open tabs":** chips built from open http(s) tabs, most recently used first, up to 8, leaving out sites already added. They refresh when tabs change.
  - **Favicons** come from Chrome's `_favicon` API (the `favicon` permission, no install warning), so no site list is sent to a third-party icon service. Sites Chrome has never seen show Chrome's generic globe.
- **Shared colour tokens:** the colours moved to `assets/tokens.css` (`:root, :host`), so the in-page notice uses the same palette as the extension pages.
- **CLAUDE.md:**
  - MVP items 1 and 2 describe the new behaviour.
  - A new **Known limitations** section, which also collects the limits found in step 2.
  - Roadmap: **Block for Mac**.

### Verified in a real Chrome (headless Chrome for Testing, real alarms)
Two scheduled back-to-back tasks, A at 09:49–09:50 allowing example.org and B at 09:50–09:51 allowing example.com:
- **09:48 (heads-up):** `upcoming` was A, and the notice appeared on example.net. The screenshot shows "Focus begins in 0:55 · Write intro".
- **09:49 (A starts on its alarm):**
  - The window went full screen.
  - example.net and example.com were parked, and example.org stayed open.
  - The service-worker test page was blocked by layer 2.
  - `upcoming` switched to B.
- **09:50 (handover to B):**
  - example.com was restored.
  - example.org was parked, and example.net stayed parked.
  - The window stayed full screen.
- **09:51 (B ends):**
  - All tabs were restored to their original URLs.
  - The window returned to normal.
  - No dynamic rules were left.

**Tests:** 38 unit tests pass: heads-up timing, `planRestore`, `suggestDomains`, the domain cleanup cases, plus the earlier ones.

### Not verified
- **Full screen on macOS with a real, visible window.** Headless reports the state change only; the move to a separate Space needs a manual check.
- **Pinterest itself while signed in.** The service-worker bypass is reproduced and fixed with a stand-in site, but Pinterest wasn't tested directly.

---

## 2026-09-23 — Step 3: The Blocked page

### What I asked
The Blocked page should be calm, not punishing. It shows:
- the current task and its "why";
- the time remaining;
- the allowed sites as clickable links;
- a quiet, secondary way to start the override, as a placeholder until step 5.

The entrance should be gentle and use the motion tokens. I approved the proposed defaults: "<site> isn't part of this task.", "Open during this task" and "End this session early".

### What was built
- **Layout:** one centred column, in reading order:
  - "<site> isn't part of this task." It shows the site's name only, never the full address.
  - The task name as the main heading (4xl).
  - The why, muted.
  - "N min left · until 10:30 AM" with a thin progress line. It's the page's only use of colour besides links.
  - "Open during this task": the allowed sites as same-tab links with favicons and a → that nudges on hover.
  - "End this session early", small and muted, well below everything else.
- **Progress line:** `sessionProgress()` measures from `startedAt` to `endsAt` in whole minutes, so the line moves once a minute instead of creeping every second.
- **Session-over state:** "Your session is over. Nothing is blocked right now." plus **Continue to <site>** when the original URL is known.
- **Handover:** the page crossfades to the next task.
- **Tab title:** "<task> · Block" during a session, "Block" afterwards.
- **Override placeholder:** `override.html` says "Ending a session early is coming soon." with "← Go back". Step 5 replaces it, and the link stays the same.
- **Motion (signature moment 3):**
  - The page fades in over `emphasized` with the `enter` easing.
  - Each line rises 8px and fades in over `standard`, with an `instant` (100ms) gap between lines.
  - The progress line grows over `emphasized` with the `standard` easing.
  - Leaving uses the `exit` easing.
  - With reduced motion, only the page fades and the progress line appears in place.
- **Accessibility:**
  - The task name is the page's main heading.
  - Link text says where it goes.
  - The countdown isn't announced (no live region), so screen readers aren't interrupted every minute.

### Verified in a real Chrome (headless)
- **Screenshots:**
  - light mode, dark mode and reduced motion;
  - mid-entrance, which shows the lines appearing in reading order;
  - the override placeholder;
  - the session-over state with "Continue to pinterest.com".
- **Links:** they point to `https://notion.so`, `https://figma.com`, `https://docs.google.com` and `override.html`.
- **Tab titles** switch correctly.
- **Tests:** 39 unit tests pass, including the new `sessionProgress` test.

---

## 2026-09-23 — Step 4: The tab limit

### What I asked
During a session, allow at most 5 open tabs. A new tab over the limit is closed, with a calm in-page notice: "5 of 5 tabs in use. Close one to open another." The popup shows tabs used / limit.

After reviewing the plan, I made two changes:
1. **Parked tabs don't count** toward the limit. The popup shows "3 of 5 in use · 7 paused".
2. **"Open here instead":** when a closed tab's URL is on the allowlist, the notice offers to load it in the current tab.

### Decision: parked tabs don't count
**What:** a tab counts as paused while it's parked (moved to the Blocked page at session start) *and* still on the Blocked page. Everything else in a normal window is in use, including tabs that hit a blocked site mid-session. Only tabs in use count toward the limit of 5.
**Why:**
- **Parked tabs are paused, not in use.** Counting them would punish people for what they had open before the session started, which Block itself chose to set aside.
- **It protects the restore feature.** If parked tabs counted, starting a session with lots of tabs would force people to close the very tabs Block promised to bring back.
- **It keeps the number honest:** "in use" means tabs you can actually work in right now.
- **A parked tab counts again once you use it.** If you click from a parked tab to an allowed site, it's in use again and counts.

### Decision: "Open here instead"
**What:** when a new tab is closed for going over the limit and its URL is on the task's allowlist, the notice includes an **Open here instead** button. It loads that URL in the current tab. There's no button when the URL isn't allowed (it would be blocked anyway) or unknown, for example ⌘T's blank new tab.
**Why:**
- **Redirect, don't punish.** Closing the tab stops a sixth tab, not the work. If what you wanted is allowed, the notice offers a way forward instead of a dead end.
- **The limit still holds.** Replacing the current tab's page keeps the count the same.
- **It never offers a blocked site,** so the button can't become a way around the allowlist.

### What was built
- **`lib/tabs.ts`:**
  - the constants `TAB_LIMIT = 5`, `TAB_NOTICE_MS = 6000` (a reading window) and `STARTUP_GRACE_MS = 10000`;
  - `countTabs()` (in use vs. paused) and `tabLimitMessage()`;
  - `parkedTabsItem`, moved here so the popup can read it.
- **Background (`tabs.onCreated`):**
  - Checks run one at a time, like the session code.
  - When a session is live and the new tab is in a normal window: count the tabs in use; if over 5, close the new tab and notify the tab the user was on. That's the tab that opened it, else the active tab in its window, else the last focused one.
  - Popup windows are ignored.
  - **Startup grace:** `session:startupAt` is set the first time the worker runs in a browser session, because session storage is wiped when Chrome restarts. Tabs created in the first 10 seconds aren't closed, so Chrome's own tab restore is left alone.
- **Notices:**
  - `lib/notice.ts` is a shared notice component in a closed shadow root, using `motion/mini` and the tokens. It supports:
    - a title, body, dot meter and action button;
    - a close button and an auto-hide timer that pauses while hovered or focused.
  - The heads-up was refactored onto it, and the content script is renamed `notices.content.ts`.
  - The tab-limit notice (`lib/tabLimitNotice.ts`) shows the message and five dots. It includes "Open here instead" when allowed, and a new one replaces the previous one instead of stacking.
  - Block's own pages (plan, Blocked, override) get content scripts too, so they listen for the same message and show it if it's meant for their tab.
- **Popup:** "**3 of 5** tabs in use · 2 paused" with a five-dot meter, live as tabs change.
- **CLAUDE.md:** MVP items 4 and 7 updated. Known limitations adds "no notice on `chrome://` pages or on pages open since before Block was installed or reloaded."

### What went wrong
- **"Open here instead" never appeared at first.**
  - Cause: a tab opened from a link (`target=_blank`) has no URL yet when `tabs.onCreated` fires.
  - Fix: before closing, `waitForUrl()` polls the tab for up to 1s until Chrome fills in the URL.
  - Verified: the button appears and works.
- **Repeated hits stacked notices on top of each other.** Now a new tab-limit notice replaces the current one.

### Verified in a real Chrome (headless)
- **Session start:** example.net and example.com were parked. The popup read "3 of 5 tabs in use · 2 paused".
- **At the limit (7 tabs total, 2 paused = 5 in use):**
  - An allowed link opened in a new tab: closed, with the notice and **Open here instead** on the opener. Clicking it loaded `example.org/wanted` in that tab, and the tab count stayed at 7.
  - A disallowed link in a new tab: closed, with a notice but no button.
  - A blank new tab (like ⌘T): closed.
- **A parked tab counts again after use:** after moving a parked tab to an allowed page, the next new tab was closed.
- **Startup grace:** with `startupAt` set to "just now", an extra tab was kept.
- **Tests:** 42 unit tests pass.

### Not verified
- **A real Chrome restart mid-session** (the grace period was simulated).
- **A new window (⌘N) over the limit.** Its only tab gets closed, which should close the window; that wasn't tested.

---

## 2026-09-23 — Decision: remove full screen on session start

### What I asked
Remove full screen on session start, for both manual and scheduled sessions. Keep the one-minute heads-up before scheduled starts.

### Why
- **Surprise without enforcement.** A browser extension can't block other apps (see Known limitations), so full screen doesn't actually keep anyone in the browser. One ⌘-Tab and they're out.
- **It works against the principles.** Full screen jumps the window into its own Space on macOS, which is a jarring change imposed on the user. That goes against "Calm over clever" and "Entering focus should feel like a shift", which means noticeable but quiet. A focus tool shouldn't grab the whole screen when it can't back that up.
- **Why the heads-up stays.** It does real work: it's the only protection for unsaved work before tabs are parked at a scheduled start.

### What changed
- **Background:** the full-screen code is removed: `enterFullscreen`, `exitFullscreen` and the saved window state.
- **CLAUDE.md:** the full-screen bullet is removed from MVP item 2. The heads-up bullet stays.
- **Checks:** type check, 42 tests and the build pass.

---

## 2026-09-23 — Decisions before step 5: linear token, business model, confession wording

### What I asked
- Add a **Business model** section to CLAUDE.md, for the case study only, not for building.
- Add a `linear` motion token, used only for motion that represents real time passing. Add the principle: "Motion that represents real time is linear, so it never misrepresents how long something takes."
- Change the confession to: "I am choosing distraction over [task name]. Morning Me is sighing."

### Decision: the `linear` token
**What:** `easing.linear` = cubic-bezier(0, 0, 1, 1). It's allowed **only** for motion that shows real time passing: the 3-second override hold fill and the countdown/progress indicators, such as the Blocked page's progress line. It's never for UI transitions.
**Why:**
- A hold-to-confirm fill is a clock. With the `standard` easing it would race through the first second and crawl through the last, so the fill would misrepresent time.
- "Friction is a feature": the user should *feel* the three seconds pass honestly, not be tricked by a curve.
- Keeping `linear` tied to real time preserves the rest of the motion system: transitions still use `standard`, `enter`, `exit` and `spring`.
- **Knock-on change:** the Blocked page's progress line moves to `linear`, because it represents time.

### Business model section
- Recorded as written. It's not built.
- It explains why the ad break parodies ads instead of selling them: the only sponsor is "Morning You".

---

## 2026-09-23 — Step 5a: Hold to confirm and emergency passes

### What I asked
Step 5 is built in three parts, and I test after each. **5a:**
- the 3-second hold to confirm (signature moment 5): a slow, deliberate fill using the `deliberate` token, with no overshoot;
- 3 emergency passes per week, shown as tokens that disappear when spent;
- spending a pass ends the session;
- the override log.

### What was built
- **`lib/override.ts`:**
  - `PASSES_PER_WEEK = 3`, and a pass record `{ weekStart: Monday "YYYY-MM-DD", used }`.
  - `passesLeft()` and `spendPass()` reset automatically when the Monday differs, so there's no reset alarm.
  - `outcomesItem`: a per-task outcome (`overridden` now; `completed`/`missed` in step 6).
  - `overrideLogItem`: entries of `{ at, taskId, taskName, method: pass|confession, result: ended|abandoned|outlasted, stage: hold|confession|ad-break, passesLeft }`.
- **Ending early stays ended.** `findDueTask` and `canStart` skip tasks with an outcome. Without this, the overridden task would restart straight away (it's still inside its time block), and again when Chrome next started. "Start now" answers "This task has already ended.", and the plan row reads "… · Ended early", stated neutrally.
- **Background messages** (run one at a time with the other session changes):
  - `override/pass` checks that the session is live and a pass is left. It spends the pass, records the outcome, logs it and ends the session (tabs restored, blocking removed). It refuses when there are no passes left, even if the page were bypassed.
  - `override/abandon` logs "Back to work" as abandoned, with its stage.
- **`HoldButton`** (signature moment 5):
  - A fill layer grows across the button over exactly `deliberate` (3s) with `easing.linear`, the new token, because the fill represents real time.
  - Letting go early drains it over `quick` with the `exit` easing, and nothing happens.
  - It always takes a full 3 seconds from empty.
  - It works with a pointer (captured, so dragging off still counts as holding), touch, and holding Space or Enter. Key repeats are ignored, letting go of the key cancels, and losing focus cancels.
  - A hidden progress bar is always there for screen readers.
  - **Reduced motion:** no fill; a plain visible progress bar fills instead, still 3 seconds.
- **Override page (`override.html`):**
  - "End this session early?", the task, its why and the time left.
  - **Back to work** is the big accent button. It goes back to the Blocked page, or to the first allowed site.
  - Pass tokens (three rings) with "N emergency passes left this week · resets Monday", then **Hold to use a pass**.
  - After the hold: "Session ended." The screen shows the tokens as they were, then the spent one fades and shrinks away (`exit` easing), with "2 emergency passes left this week." and **Open plan**. The last pass reads "That was your last emergency pass this week. They reset Monday."
  - No passes left: "No emergency passes left this week. They reset Monday." and "Without a pass, this session runs until …". This is a placeholder until 5b adds the confession.
  - With no session running: "No focus session is running."
- **Blocked page:** the progress line now uses `easing.linear`, following the new principle.
- **Developer settings** (collapsed, at the bottom of the plan page, labeled "These change your real data"):
  - **Reset passes**;
  - the latest 10 override-log entries.
  - The short ad break and sample data arrive in 5c.

### Verified in a real Chrome (headless)
- **From the Blocked page,** "End this session early" opens the override page with the task, the why, the time left and 3 tokens.
- **A 1.5s hold does nothing:** the session keeps running and no pass is used. The mid-hold screenshot shows the fill at about half, which confirms the linear easing.
- **A full 3.3s mouse hold:**
  - Result: "Session ended. 2 emergency passes left this week."
  - Stored: `passes.used = 1`, and outcome `A: overridden`.
  - "Start now" for A is refused, and the plan row shows "Ended early".
- **A keyboard hold** (Space, then Enter) spends passes 2 and 3. The last shows "That was your last emergency pass this week."
- **"Back to work"** keeps the session running and logs `abandoned at hold`.
- **With no passes:** the page shows the no-passes state, and a direct `override/pass` message is refused ("No emergency passes left this week.").
- **The log has four entries:**
  - A: pass, ended, 2 left;
  - B: pass, ended, 1 left;
  - C: pass, abandoned;
  - C: pass, ended, 0 left.
- **Reduced motion:** a plain progress bar fills under the button.
- **Tests:** 46 unit tests pass, including the weekly reset (Monday 00:00, across a month boundary) and finished tasks not restarting.

### Note
The test used overlapping tasks on purpose, so each override handed over to the next "due" task. The plan page never allows overlapping tasks, so in real use an override simply ends the session.

---

## 2026-09-23 — Plan change: randomized confession lines

### What I asked
Replace the single confession sentence with one of four lines, picked at random each time, followed by "[task name] can wait.":
- "I would like to abandon my potential please."
- "I am voluntarily entering the scroll hole."
- "Please return me to the content mines."
- "I would rather consume content than become the person I said I wanted to be."

Keep the matching forgiving of capitalization, extra spaces **and punctuation**, and keep paste disabled.

### What changed
- **CLAUDE.md, Override design item 3,** is rewritten with the four lines, an example, and the matching rule.
- **Punctuation is now ignored too.** Previously only capitalization and spaces were. The words still have to match, including the task name.
- **Detail I filled in:** a line is picked once per attempt and stays fixed while the user types, so it never changes mid-sentence. A new attempt, such as reopening the override page, may get a different line.
- **"Morning Me is sighing."** is dropped in favour of the new format.

### Why
- **Variety keeps it from turning into muscle memory.** A fixed sentence can be typed on autopilot; a line that changes each time has to be read first, which is the friction we want.
- **Ignoring punctuation** means the effort is in writing out the words, not in getting a comma or full stop exactly right. That keeps it friction, not a gotcha.

Not built yet; this is part of step 5b.

---

## 2026-09-23 — Step 5b: The confession

### What I asked
- Build the confession for when passes run out: one of the four lines picked at random, then "[task name] can wait.".
- It's forgiving of capitalization, extra spaces and punctuation, with paste disabled.
- Keep all four lines, and reword principle #3 to match what they are: "The confession is private and self-aware: a little uncomfortable on purpose, never cruel."

### What was built
- **CLAUDE.md principle #3** is reworded as above.
- **`lib/override.ts`:**
  - `CONFESSION_LINES`, `pickConfessionLine()` and `buildConfession(line, task)`, which gives "<line> <task> can wait.";
  - `normalizeConfession()`: lowercase; drop apostrophes and quotes ("Maya's" → "mayas"); turn other punctuation into spaces ("case-study" → "case study"); collapse spaces;
  - `confessionMatches()`, which also rejects empty input.
- **Flow:** with 0 passes, the hold button reads "Hold to continue without a pass". After the full 3-second hold, the confession screen appears:
  - "No emergency passes left this week."
  - "Say it in your own words. Well, these words."
  - the sentence in a card (not selectable, so it can't be copied);
  - a textarea labeled "Type it to continue";
  - **Continue**, enabled only on a match, with a quiet "Matches." that fades in;
  - **Back to work** underneath, still the big button.
- **Paste and drop are blocked,** with the hint "Pasting is off. Type it out; that's the point." Before any paste attempt, the hint reads "Capitals and punctuation don't matter." Autocorrect, autocapitalize and spellcheck are off. Enter submits when the text matches.
- **A new line is picked once per attempt,** when the hold completes. It stays fixed while typing.
- **After Continue:** "Noted." and a placeholder: the 10-minute ad break is step 5c, so for now the session keeps running.
- **Logging:** "Back to work" logs `confession, abandoned` at stage `confession`, or at `ad-break` from the placeholder.
- **Motion-token fix:** Tailwind's `transition-*` utilities defaulted to 150ms with Tailwind's own easing, which is outside the token system. The theme now sets `--default-transition-duration: 200ms` (`quick`) and `--default-transition-timing-function` to the `standard` curve. This applies to the existing hover and fade transitions: buttons, chips and the favicon arrow.

### What went wrong
- **Hyphens.** My first normalization *deleted* all punctuation, so "case-study" became "casestudy" and didn't match "case study". Apostrophes are now removed, and other punctuation becomes a space.

### Verified in a real Chrome (headless)
- **No passes:** the page offers "Hold to continue without a pass". A 3.3s Space hold opens the confession, for example "Please return me to the content mines. Review Maya's deck can wait."
- **Paste:** a paste event is cancelled, and the hint switches to "Pasting is off…".
- **A wrong sentence** keeps Continue disabled.
- **Sloppy but correct** input unlocks Continue: all lowercase, no full stops, double spaces and a straight apostrophe instead of a curly one. Enter then shows "Noted." and the placeholder.
- **Log:** `confession, abandoned at ad-break` and `confession, abandoned at confession`, each with 0 passes left. The session stayed running throughout.
- **Tests:** 51 unit tests pass, covering the confession build, the forgiving matching, the words still required (including the task name), apostrophes and quotes in task names, and all four lines being picked.

### Not yet logged
Leaving the page during the confession, for example by closing the tab, isn't logged yet. 5c adds a live connection to the background worker that logs a departure as abandoned and resets the ad break.

---

## 2026-09-23 — Usability finding: "Back to work" in the submit path

### Finding (from my own testing of 5b)
After typing the confession, I **accidentally clicked "Back to work"**. It sat right below the form, where a submit button usually is, so my hand went there on autopilot. The prominent, easy choice had become a trap in the one place people are primed to click "go".

### Change
- **"Back to work" moves to a top bar** on the confession screen, and will stay there through the ad break. The bar reads "Focusing on <task>" with the accent **Back to work** button on the right. It's still prominent and always visible, but it's no longer where a submit button would be.
- **The submit button reads "Release me".**
  - Before a match: disabled and quiet (outlined, muted text).
  - On a match: it turns the accent colour, and a small ✓ appears (`quick` token; colour via the Tailwind transition defaults, also `quick`).
  - Screen readers hear "Matches. Press Enter to continue."
  - Enter submits.
- **The task name is in quotes:** "I am voluntarily entering the scroll hole. “Write the case study intro” can wait." The quotes set the task apart from the joke line. Typing them is optional, since quotes are ignored when matching.
- The quiet "Matches." text is gone; the button's state carries that message now.

### Why this matters
- **The friction belongs in the typing, not in the layout.** A mis-click that throws away a finished confession is a gotcha, which is punishment, not friction.
- **A button's position is a promise.** The bottom-right of a form means "submit", so the escape hatch shouldn't sit there.
- **Moving "Back to work" to the top keeps the ethics intact.** The easy way back stays visible the whole time, without competing with the action the user chose.

### Verified in a real Chrome (headless)
- The top bar shows "Focusing on Review Maya's deck · Back to work" on the confession and "Noted." screens.
- "Release me" stays disabled until the text matches, then turns accent with ✓. Enter submits.
- The sentence renders with curly quotes around the task name, and matches when typed without quotes.
- "Back to work" from the top bar still logs abandoned attempts with the correct stage.
- **Tests:** 52 unit tests pass, including that typing the quotes is optional.

**CLAUDE.md** Override design item 3 is updated: quotes, the "Release me" behaviour, and the top-bar placement.

---

## 2026-09-23 — Change: confession lines typed as written

### What I asked
Keep the original release sentences as they are. Don't add the task name ("“[task name]” can wait.").

### What changed
- **The confession is now just the randomly picked line,** exactly as written. For example: "Please return me to the content mines." Nothing is appended.
- **Code:** `buildConfession()` is removed, and the override page shows `stage.line` directly.
- **Matching** is unchanged: it ignores capitalization, punctuation and extra spaces; the words must match; paste stays disabled.
- **CLAUDE.md** Override design item 3 is updated. The example and the task-name/quote rules are removed.
- **Tests:** rewritten for bare lines, including that every line matches when typed in lowercase without punctuation. 50 tests pass.

### Why
- **The lines work on their own.** They're self-contained jokes, and adding "“Write the case study intro” can wait." made them longer without making them land harder.
- **The task is still in view:** the top bar reads "Focusing on <task>", so the confession doesn't need to repeat it.

---

## 2026-09-23 — Morning Plan: two columns, "Earlier today", now marker, time defaults

### What I asked
1. **Two columns on wide windows:** Add a task on the left and Today on the right, both visible from the top. On narrow windows, stack them with the form first.
2. **Schedule order:** current and upcoming tasks first. Past tasks collapse under "Earlier today (N)" and expand on click.
3. **A subtle "now" marker.**
4. **Adding a task** (signature moment 1): it settles into its place over `standard` with the `enter` easing, while the other tasks shift smoothly to make room.
5. **The default time should reflect the current time,** to reduce input errors (AM/PM).

### What went wrong
- **The request looked like it had been ignored.** After I showed the plan, you reported "I still don't see the two column layout". That was expected, because nothing had been built yet: I was waiting for approval, per CLAUDE.md. I took the message as approval and built it.
- **Lesson:** when a plan is waiting, say so clearly at the end, and make the approval step unmistakable.

### What was built
- **`lib/schedule.ts`** (pure, unit-tested):
  - `suggestSlot()`: now, rounded up to 5 minutes. If that falls inside a task, it moves to that task's end, including across back-to-back tasks. It's 1 hour long, but stops before the next task's start and never runs past 11:59 PM.
  - `partitionSchedule()`: sorts tasks into current, upcoming and earlier. Earlier means the end has passed or the task already has an outcome, such as ended early by override.
  - `progressThrough()`: how far through a task you are, for the now marker.
- **Layout.**
  - Page width is `max-w-6xl`, with a compact header: date, "Morning plan" and the intro line.
  - At the `lg` breakpoint and up, the grid is 5fr / 7fr: form on the left, Today on the right, both starting at the top. Below `lg`, it's one column with the form first.
  - I dropped the idea from the plan of pinning the form while scrolling. The form, with its site suggestions, can be taller than the window, and a pinned element taller than the window hides its own bottom.
- **Schedule.**
  - The task in progress comes first, then upcoming tasks.
  - **Earlier today (N)** is a disclosure button (`aria-expanded`, `aria-controls`). Its chevron rotates over `quick`, and the list expands in height and fades over `standard` with the `enter` easing. Earlier rows are slightly muted.
  - Tasks move into Earlier today as their time passes.
- **Now marker.**
  - With a task in progress, a small accent dot sits on that task's time bar at its progress point. It moves with `easing.linear`, since it represents real time.
  - Otherwise, a quiet "Now · 11:01 AM" line appears above the next task.
- **Signature moment 1.**
  - New rows fade in and rise 12px, and the other rows shift position, all on the same `{ duration: standard, ease: enter }`. This replaces the spring used before.
  - The new row's time bar lands in the accent colour, then fades to neutral as before.
  - After adding, the new task is scrolled into view (`block: 'nearest'`, smooth unless reduced motion is on). If it lands in the past, Earlier today opens automatically.
  - Undo uses the same reveal.
  - **Reduced motion:** fade only, with no position shifts.
- **Default times.**
  - The new-task form uses `suggestSlot()`.
  - Until you touch either time field, the defaults move forward with the clock (the `followInitialTimes` prop), so a plan page left open since morning doesn't suggest a stale time.
  - After adding a task, the next default starts at that task's end if it's the next free slot.
- **CLAUDE.md:** MVP item 1 describes the layout, the schedule and the time defaults.

### Verified in a real Chrome (headless)
- **Wide (1360px):**
  - The form and Today sit side by side from the top.
  - The in-progress task shows the now dot.
  - "Earlier today (2)" is collapsed, and expands with `aria-expanded=true`.
- **Default start:** at 11:01, it was 11:41, because 11:05 fell inside the task running 10:41–11:41.
- **Adding a task:** "Reply to recruiter" (11:41–11:56) settled between the current task and "Review Maya's deck". The mid-animation screenshot shows its accent bar while the rows below shift. The next default then became 11:56.
- **Narrow (700px):** one column, form first.
- **Tests:** 58 unit tests pass, adding `suggestSlot` (rounding, skipping clashes, stopping before the next task, the 11:59 PM cap), `partitionSchedule` (the end minute, ended-early tasks) and `progressThrough`.

---

## 2026-09-23 — Copy concept: the severed browser

### What I asked
- **New copy concept:** during a session, the browser is "severed". Your work self is inside, and everything blocked or parked belongs to your "outside self". It's a consensual, self-chosen separation, inspired by the show *Severance*.
- The first draft brief also said the product should use only its own original language: no show names, terms or visuals.
- The tone should be calm and warm, never eerie.

The drafts:
- **Heads-up:** "Severing in 1:00. Save anything you'll want later."
- **Blocked page:** "That's an outty task. In here, you're working on 'Buy Anniversary Gift.'"
- **Parked tabs:** "4 tabs waiting for your outty."
- **Popup:** "Severence · 18 min left"
- **Session end:** "Welcome back outty. Your tabs are right where you left them."
- **Ad break:** unchanged.

### The conflict raised, and the decision
- **Claude's flag:** several drafts broke the brief's own "original language only" rule.
  - "Severence" is one letter off the show's title and could imply an affiliation.
  - "Outty" is a near-copy of the show's term.
- **The alternative offered** used only the concept's own words, inside and outside self: "Going inside in 1:00", "That's for your outside self", "Inside · 18 min left", "Welcome back."
- **My decision:** keep the original drafts, except the popup, which says **"Innie · 18 min left"** instead of "Severence". So the show's *name* stays out of the product, and the innie/outty/severing vocabulary stays in.

### Why
- The innie/outty pair is instantly legible and warm. It gives the separation a playful, human name, which the plainer inside/outside words don't.
- "Outty" is spelled differently, and "innie" is also everyday English.
- **Risk accepted and recorded:** people who know the show will recognise the words.
- **Mitigation:** never name the show in the product, never borrow its visuals, and never pair the words with anything suggesting an affiliation. CLAUDE.md's Honesty rules now say this explicitly.

### What changed
- **`lib/copy.ts`** is new and holds all the session copy in one place.
- **Heads-up notice** (in-page): "Severing in 0:55." / "Save anything you'll want later." The task name is no longer in the notice. The popup and plan-row countdowns also read "Severing in 0:42".
- **Blocked page:** "That's an outty task. In here, you're working on" above the task as the main heading, in quotes: "“Buy anniversary gift.”" The blocked site's name is no longer shown.
  - When tabs are parked, "4 tabs waiting for your outty." appears under the allowed sites.
  - The session-over state reads "Welcome back outty." / "Your tabs are right where you left them." with **Continue to <site>** kept.
- **Popup:** the status line reads "Innie · 18 min left". It replaces the "IN FOCUS" label and the large time line, which is folded into the status. "Until 10:30 AM" stays. The parked line reads "4 tabs waiting for your outty." under the tab count, replacing "· 4 paused".
- **Override:** after spending a pass, the screen reads "Welcome back outty." / "Your tabs are right where you left them." above the pass tokens.
- **Ad break:** unchanged.
- **CLAUDE.md:**
  - Design direction has a new "Copy concept: the severed browser" subsection, with the concept, the tone, the inspiration, the vocabulary decision and its accepted risk, and the copy table.
  - The heads-up line in MVP item 2 is updated.
  - The Honesty rules add: never name the show in the product, and never imply affiliation.

### Verified in a real Chrome (headless)
- **Popup:** "Innie · 18 min left / Buy anniversary gift / Ten years on Saturday / Until 11:23 AM / 3 of 5 tabs in use / 4 tabs waiting for your outty."
- **Blocked page:** "That's an outty task. In here, you're working on / “Buy anniversary gift.” / Ten years on Saturday / 18 min left · until 11:23 AM / etsy.com → uncommongoods.com → / 4 tabs waiting for your outty. / End this session early".
- **Session end:** "Welcome back outty. / Your tabs are right where you left them. / Continue to pinterest.com".
- **Checks:** 58 tests, the type check and the build pass.

---

## 2026-09-23 — Step 5c: The ad break

### What I asked
The 10-minute unskippable ad break, following the approved plan and the Override design:
- **Spots,** made only from my own data, never real ads:
  - The Pitch (the task and its why);
  - The Countdown (live time left in the block);
  - The Testimonial (tasks completed this week, as "Morning You ★★★★★" reviews);
  - The Breathing Spot (one minute, a calm expanding circle);
  - The Fine Print (tiny disclaimer-style humour);
  - The Allowed Sites (one-click links).
- **Frame:**
  - header: "Ad 3 of 12 · Your break begins in 7:42";
  - "Sponsored by Morning You";
  - skip area: "Skip unavailable. You set this up for a reason.";
  - "Back to work" always visible, as the easy choice.
- **Rules:**
  - leaving the page resets the countdown;
  - if the session ends during the break: "Good news: you made it. Your session is over.";
  - skip spots with no data;
  - log abandoned attempts.
- **Developer settings:** a 10-second ad break, reset passes, and sample data for demos.

### What was built
- **`lib/adbreak.ts`** (pure, unit-tested):
  - Constants: `AD_BREAK_MS` (10 min), `AD_SPOT_COUNT` (12), `BREATHING_SPOT_MS` (60s), the developer break `DEV_AD_BREAK_MS` (10s, 4 spots), and the breathing pace (4s in, 6s out). These are policy constants, not motion tokens.
  - `planAdBreak()`: the breathing spot is Ad 7; the other 11 slots cycle Pitch → Countdown → Testimonial → Fine Print → Allowed Sites, and the Testimonial drops out when there's no data. Each other spot is about 49.09s, with rounding leftovers given to the last spot so the total is exactly 600,000 ms. The same kind never plays twice in a row, and repeated kinds use varied copy.
  - `spotAt()`: which spot is playing at a given moment.
  - `completedThisWeek()`: real completions only, from Monday 00:00.
  - `FINE_PRINT` lines.
- **Background (port `ad-break`):**
  - The override page opens a port and sends `start`. The background checks that the session is live, that it's the confession path (0 passes), and the developer setting, then records `startedAt` and the duration.
  - The page sends `complete` when its clock says done. The background ends the session only if the full time has passed (1s tolerance); otherwise it answers `not-yet`.
  - On success, the task's outcome is `overridden`, the log records `confession, ended @ ad-break`, the session ends (tabs restored) and the page is told `ended`.
  - **Leaving the page** (disconnect) logs `abandoned @ ad-break`, and the next attempt starts from Ad 1.
  - **The session ending on its own** logs `outlasted`. That's detected either at reconcile time or when the page disconnects after the session's end time.
  - The page pings every 20s to keep the worker awake during the break.
- **`AdBreak` + `AdSpots` components:**
  - **Header:** "Ad N of 12 · Your break begins in m:ss", with a screen-reader live line such as "Ad 3 of 12: The Testimonial".
  - **Frame:** an "AD" chip; a thin per-spot progress line that runs the spot's length (`linear`, since it's real time, and hidden with reduced motion); spots crossfade (`enter` in, `exit` out); "Sponsored by Morning You" bottom-left; and a disabled-looking skip box bottom-right with the exact line.
  - **The Pitch:** "Now showing" / "Still showing" / "Back by popular demand", the task as the headline, the why in quotes, and "Only in this tab. Only for a limited time."
  - **The Countdown:** "Limited time only", a big m:ss of the block's remaining time, and "left in “task” · ends 11:59 PM".
  - **The Testimonial:** "What people are saying", up to 3 review cards ("★★★★★ / “Task. Done.” / Morning You · Tuesday"), "N tasks completed this week", and a **Sample data** chip whenever sample tasks are shown.
  - **The Breathing Spot:** "A word from your lungs", a circle growing (4s in) and shrinking (6s out) on the `standard` easing, and "Breathe in…" / "Breathe out…". With reduced motion it shows the text cues only, in a larger size.
  - **The Fine Print:** two rotating lines plus "Offer valid until <end>. Void where focus is prohibited. Morning You makes no guarantees, only plans."
  - **The Allowed Sites:** "Also available in this tab", one-click links with favicons, and "One click. No break required."
- **Override page:**
  - "Release me" now leads into the ad break, and the "Noted." placeholder is gone.
  - The frame widens to `max-w-3xl` during the break, with the top bar still showing "Focusing on <task> · Back to work".
  - The task is pinned for the break, so the page keeps working if the session ends under it.
  - **End screens:**
    - "Welcome back outty. Your tabs are right where you left them." when the break completes;
    - "Good news: you made it. Your session is over." when the session is outlasted;
    - a plain error if the background refuses to start the break.
- **Developer settings:**
  - **Short ad break** toggle.
  - **Sample data: Fill / Clear.** Fill adds up to 5 completed sample tasks earlier this week, or earlier today on a Monday, in free slots only. Every one is marked `sample: true` and shows a **Sample** chip on the plan page, per the honesty rules. Clear removes them and their outcomes.
  - **Reset passes** and the override log, as before.
- **Plan page:** completed tasks read "… · Completed".
- **CLAUDE.md:** the Override design lists the six spots, the order rules and the background-timed completion.

### What went wrong
- **An outlasted break was logged as abandoned.** The page's own clock can notice the session's end time before the background's end alarm fires. The page then shows "Good news…" and closes its port, and the background treated the disconnect as leaving.
- **Fix:** on disconnect, if the session is gone or past its end time, log `outlasted`.
- **Verified with a real end-of-task alarm:** the log reads `confession outlasted@ad-break`.

### Verified in a real Chrome (headless)
- **Full break:** "Ad 1 of 12 · Your break begins in 10:00".
- **Stepping through by shifting only the page's clock:** Pitch, Countdown, Testimonial, Fine Print, Allowed Sites, Pitch, **Breathing (Ad 7)**, Countdown, Testimonial, Fine Print, Allowed Sites, Pitch. Screenshots were reviewed for the Pitch, Testimonial (with the Sample data chip), Fine Print and Breathing.
- **Anti-cheat:** jumping the page's clock past the end made the page send `complete` early. The background refused, and the session kept running.
- **Reloading mid-break** returned the page to "End this session early?" and logged `abandoned @ ad-break`. The next attempt started at Ad 1.
- **The developer 10-second break** played Pitch, Countdown, Breathing, Testimonial, then "Welcome back outty…". The session ended, the outcome is `overridden`, and the log reads `confession ended @ ad-break`.
- **"Back to work" in the top bar** during a break went back to the Blocked page and logged a single `abandoned @ ad-break`.
- **Tests:** 66 unit tests pass: the plan adds up to exactly 10 minutes, one 60s breathing spot at Ad 7, the Testimonial is skipped without data, no repeats back-to-back, variants, the 10-second developer plan, `spotAt` and `completedThisWeek`.

### Not verified / known limits
- **A real, uninterrupted 10-minute run** in a visible window. Covered by the clock-shift tour, the anti-cheat check and the 10-second run.
- **If Chrome kills the background worker mid-break** despite the pings, the port drops and the break resets. It's logged as abandoned, so the user would have to start over.
- **The Testimonial needs completed tasks,** which step 6 creates. Until then, it only appears with sample data.

---

## 2026-09-23 — Step 6: Task completion, and finishing early

### What I asked
- **Step 6:** at session end, ask "Did you finish?" and mark the task complete or missed. A task that ends without an answer is marked missed.
- **Finishing early:** during a session, a **Done** button in the popup and on the Blocked page. No friction, just a light check: "Done already? 16 of 60 minutes." then "Yes, done." Then two choices:
  - **Start next task now:** the next task starts immediately and keeps its planned length; later tasks stay where they are.
  - **Take the time back:** blocking ends until the next task's scheduled start, with "You earned 44 minutes."
  - With no next task, only "Take the time back".
- Log the completion time.
- Note in CLAUDE.md that Done is honor-based by design: Block is a commitment device, not a lie detector.

### Decisions I filled in (building straight away, as asked)
- **The finished task's end moves to the moment it was finished,** at least 1 minute after its start. That way the next task can start right away without overlapping it. The original end is kept as `plannedEnd` on the outcome.
- **At a session's natural end,** the task is recorded as `missed` with `pending: true`, which means not yet answered. Answering Yes turns it `completed`, with its completion time set to the task's end. A missed task can still be changed to completed later; a completed one isn't flipped back.
- **Past tasks that never had a session** (for example, Chrome was closed) also get the question on their plan row. You may have done them without Block.
- **Overridden tasks aren't asked about;** the override already records how they ended.

### What was built
- **`lib/completion.ts`** (pure, unit-tested):
  - `doneSummary()`: elapsed and total minutes of the session, and the minutes earned.
  - `nextTaskAfter()`: the next task today that isn't finished.
  - `trimmedEnd()` and `shiftedTo()`: the next task keeps its length, capped at 11:59 PM.
- **Outcomes** gain `pending`, `early` and `plannedEnd`.
- **`completionLogItem`:** every Done and every answer, with time, how (`done-early` / `answered`), minutes worked out of planned, and what came next (`start-next` / `take-back`).
- **Background:**
  - `session/done`: marks the task completed (early), trims its end, logs it, then either moves the next task to now and starts it (tabs re-parked for the new allowlist) or ends the session (tabs restored).
  - `task/answer`: records the Yes/No answer.
  - On a natural end: the outcome becomes pending, then about 1.5s later, once restored tabs have loaded, the question is shown on the active web page.
- **In-page question:** "Welcome back outty. / Did you finish “Reply to Maya”?" with **Yes, finished** / **Not this time**. The shared notice now supports two buttons. Dismissing it leaves the question pending.
- **`DoneFlow`** (popup and Blocked page), in steps:
  1. **Done**
  2. "Done already? 16 of 60 minutes." with **Yes, done.** / **Not yet**
  3. A checkmark with "Nicely done. What now?" and the two choices. Each shows what will happen: "Review deck · until 12:19 PM", or "Free until 12:19 PM" / "Free for 44 minutes".
  4. The result. The popup keeps "You earned 44 minutes." (or "Now: Review deck, until 12:19 PM.") in a banner. The Blocked page's session-over state leads with the checkmark and "You earned 44 minutes."
- **`FinishedQuestion`** (Blocked page after a natural end, popup, plan rows): Yes shows the checkmark and "Done. Nicely finished."; No shows "Noted. It happens." Plan rows then read "· Completed" or "· Missed".
- **`CheckMark`** (signature moment 6): the circle settles in with the no-overshoot `spring`, then the check draws itself over `emphasized` with the `enter` easing. With reduced motion it simply fades in.
- **Developer settings:** the completion log (the latest 10).
- **CLAUDE.md:**
  - MVP item 6 describes where the question is asked, finishing early and its two choices, the honor-based note ("Block is a commitment device, not a lie detector") and signature moment 6.
  - MVP item 7 adds the Done button.

### Fixes found during testing
- **"Earlier today" was in storage order.** Tasks written unsorted (sample data, test data) listed out of time order. `partitionSchedule` now sorts, "Fill sample data" saves sorted, and there's a new test.
- **The 80% dimming on "Earlier today" rows** washed out the question's buttons, so it's removed.

### Verified in a real Chrome (headless)
- **Done, then Take the time back** (popup, no next task):
  - "Done already? 16 of 60 minutes."
  - only "Take the time back · Free for 44 minutes" is offered;
  - the result reads "You earned 44 minutes.";
  - the session ended, the parked example.net tab was restored, and the task's end became 11:19 (planned 12:03);
  - the outcome is `completed, early`, and the log reads `done-early 16/60 take-back`.
- **Done, then Start next task now** (Blocked page):
  - B ended at 11:19;
  - C moved from 12:19–13:19 to **11:19–12:19**, keeping its hour;
  - D stayed at 13:49;
  - the session is now C, and the Blocked page switched to "Review deck".
  - The log reads `done-early 16/60 start-next`.
- **Natural end** (real alarm at 11:20):
  - the outcome became `missed, pending`;
  - the in-page question appeared on the active page (screenshot);
  - **Yes, finished** turned it `completed`, and the log reads `answered`.
- **Plan rows:** two past tasks with no answer showed "Did you finish …?". Yes gave "· Completed", and Not this time gave "· Missed".
- **Tests:** 73 unit tests pass.

### Not verified
- **The Testimonial with real completions in a live ad break.** It's unit-tested, and it uses the same data path as sample data.

---

## 2026-09-23 — Copy: Morning Plan speaks to the innie

### What I asked
- **Intro:** "Decide now what later-you can open. Each task gets a time and the few sites it actually needs." → "Decide now what your innie can open. Each task is assigned a time block and the few sites needed to complete it."
- **Heading:** "Add a task" → "Add a task for your innie".

### What changed
- Both strings now live in `lib/copy.ts` (`planIntro`, `addTaskHeading`), and the plan page reads them from there.
- The copy table in CLAUDE.md is updated.
- The Morning Plan now uses the same severed-browser language as the rest of the session copy.
