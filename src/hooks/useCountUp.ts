import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` with an ease-out curve once
 * `start` is true. Jumps straight to the target when the user prefers
 * reduced motion.
 */
export function useCountUp(target: number, start = true, durationMs = 1100): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;

    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      return;
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - t0) / durationMs));
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, start, durationMs]);

  return value;
}
