import { motion, useReducedMotion } from 'motion/react';
import { duration, easing, spring } from '@/lib/motion';

/**
 * Signature moment 6: task complete. The circle settles in (spring, no overshoot),
 * then the check draws itself. Closure that feels good, never loud.
 */
export function CheckMark({ size = 40 }: { size?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      initial={{ opacity: 0, scale: reduce ? 1 : 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduce ? { duration: duration.quick } : spring}
    >
      <circle cx="20" cy="20" r="19" className="fill-accent-soft" />
      <motion.path
        d="M12 20.5l5.5 5.5L28 15"
        fill="none"
        className="stroke-accent"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: duration.emphasized, ease: easing.enter, delay: reduce ? 0 : duration.quick }}
      />
    </motion.svg>
  );
}
