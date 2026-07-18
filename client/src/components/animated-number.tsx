import { useEffect, useState } from "react";
import { animate } from "framer-motion";

/**
 * Count-up numeral. The final value is guaranteed even if animation frames
 * never run (throttled/hidden tabs) — the animation is purely cosmetic.
 */
export function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    const fallback = window.setTimeout(() => setDisplay(value), 1000);
    return () => {
      controls.stop();
      window.clearTimeout(fallback);
    };
  }, [value]);

  return <span className="tabular-nums">{display}</span>;
}
