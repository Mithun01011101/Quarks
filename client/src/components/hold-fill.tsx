import { motion } from "framer-motion";
import type { HoldFillValues } from "@/hooks/use-hold-to-complete";

/**
 * The habit's colour spreading out from under the thumb while a bubble is
 * held. Goes inside the bubble's rounded, overflow-hidden button, before its
 * content (which sits above it on z-[5]). Position and size come from
 * useHoldToComplete; only transform + opacity change per frame, so the
 * phone's compositor can keep it smooth.
 *
 * Positioned with framer's x / y — NOT Tailwind's -translate-* classes: the
 * inline transform framer writes for `scale` replaces any class transform,
 * which is how the old fill ended up off-centre (only a corner coloured, and
 * only in the last moments).
 */
export function HoldFill({ values, color }: { values: HoldFillValues; color: string }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 rounded-full"
      style={{
        width: values.size,
        height: values.size,
        x: values.x,
        y: values.y,
        scale: values.scale,
        opacity: values.opacity,
        backgroundColor: color,
        willChange: "transform, opacity",
      }}
    />
  );
}
