/**
 * Motion tokens — the ONLY timing values allowed in Block.
 * Shared with the portfolio motion system. Never hardcode durations or easings.
 */

/** Durations in milliseconds. */
export const durationMs = {
  instant: 100,
  quick: 200,
  standard: 300,
  emphasized: 500,
  /** Override hold only. */
  deliberate: 3000,
} as const;

/** Durations in seconds, for Motion transitions. */
export const duration = {
  instant: durationMs.instant / 1000,
  quick: durationMs.quick / 1000,
  standard: durationMs.standard / 1000,
  emphasized: durationMs.emphasized / 1000,
  deliberate: durationMs.deliberate / 1000,
} as const;

type Bezier = [number, number, number, number];

export const easing = {
  standard: [0.2, 0, 0, 1] as Bezier,
  enter: [0, 0, 0, 1] as Bezier,
  exit: [0.3, 0, 1, 1] as Bezier,
  /** Only for motion that represents real time passing (hold fill, countdowns). Never for UI transitions. */
  linear: [0, 0, 1, 1] as Bezier,
} as const;

/** No overshoot, ever. */
export const spring = { type: 'spring', stiffness: 400, damping: 40 } as const;

/** Preset transitions built only from the tokens above. */
export const transition = {
  standard: { duration: duration.standard, ease: easing.standard },
  enter: { duration: duration.standard, ease: easing.enter },
  exit: { duration: duration.quick, ease: easing.exit },
  quick: { duration: duration.quick, ease: easing.standard },
  instant: { duration: duration.instant, ease: easing.standard },
  spring,
} as const;
