/**
 * Session copy. Concept: during a session the browser is "severed". Your work
 * self (the innie) is inside; everything blocked or parked belongs to your outty.
 * A consensual, self-chosen separation. Calm and warm, never eerie.
 * See CLAUDE.md → Design direction.
 */
export const copy = {
  /** Heads-up, a minute before a scheduled session: "Severing in 1:00." */
  headsUpLead: 'Severing in ',
  headsUpBody: 'Save anything you’ll want later.',

  /** Blocked page: "That's an outty task. In here, you're working on '<task>.'" */
  blockedLine: 'That’s an outty task.',
  blockedLead: 'In here, you’re working on',

  /** Tabs parked at session start. */
  parked: (n: number) => `${n} ${n === 1 ? 'tab' : 'tabs'} waiting for your outty.`,

  /** Popup during a session: "Innie · 18 min left". */
  popupStatus: (remaining: string) => `Innie · ${remaining}`,

  /** Morning Plan. */
  planIntro: 'Decide now what your innie can open. Each task is assigned a time block and the few sites needed to complete it.',
  addTaskHeading: 'Add a task for your innie',

  /** Session end. */
  welcomeTitle: 'Welcome back outty.',
  welcomeBody: 'Your tabs are right where you left them.',
} as const;
