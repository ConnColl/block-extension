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
