import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, type AnimationPlaybackControls } from 'motion/react';
import { duration, easing } from '@/lib/motion';

interface Props {
  children: ReactNode;
  /** Label while holding, e.g. "Keep holding…". */
  holdingLabel: string;
  onComplete: () => void;
  disabled?: boolean;
}

/**
 * Signature moment 5: hold to confirm. The fill takes exactly `deliberate` (3s)
 * and is linear — it represents real time, so it never misrepresents how long
 * is left. Letting go early drains it back; nothing happens.
 * Works with pointer, touch, and holding Space or Enter.
 */
export function HoldButton({ children, holdingLabel, onComplete, disabled }: Props) {
  const reduce = useReducedMotion();
  const progress = useMotionValue(0);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const [percent, setPercent] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useMotionValueEvent(progress, 'change', (v) => setPercent(Math.round(v * 100)));
  useEffect(() => () => controls.current?.stop(), []);

  function start() {
    if (disabled || done || holding) return;
    setHolding(true);
    controls.current?.stop();
    // Always a full 3 seconds from empty, even if a previous release hadn't drained yet.
    progress.set(0);
    controls.current = animate(progress, 1, {
      duration: duration.deliberate,
      ease: easing.linear,
      onComplete: () => {
        setHolding(false);
        setDone(true);
        onCompleteRef.current();
      },
    });
  }

  function release() {
    if (!holding || done) return;
    setHolding(false);
    controls.current?.stop();
    controls.current = animate(progress, 0, { duration: duration.quick, ease: easing.exit });
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        aria-describedby="hold-hint"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          start();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') release();
        }}
        onBlur={release}
        onContextMenu={(e) => e.preventDefault()}
        className="relative w-full touch-none overflow-hidden rounded-xl border border-line bg-surface px-5 py-3.5 text-sm font-medium text-ink select-none disabled:opacity-50"
      >
        {!reduce && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 origin-left bg-accent-soft"
            style={{ scaleX: progress }}
          />
        )}
        <span className="relative">{holding ? holdingLabel : children}</span>
      </button>

      {/* Reduced motion: still 3 seconds, shown as a plain progress bar instead of the fill. */}
      <div
        role="progressbar"
        aria-label="Hold progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className={reduce ? 'mt-3 h-1 overflow-hidden rounded-full bg-line' : 'sr-only'}
      >
        {reduce && <div className="h-full bg-accent" style={{ width: `${percent}%` }} />}
      </div>

      <p id="hold-hint" className="mt-2 text-center text-xs text-muted">
        Press and hold for 3 seconds. Let go to cancel.
      </p>
    </div>
  );
}
