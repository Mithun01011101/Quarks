import { useCallback, useRef, useState } from "react";
import { animate, useMotionValue, type AnimationPlaybackControls } from "framer-motion";
import { initAudio } from "@/lib/audio";
import { stopVibration, vibrate } from "@/lib/settings";

// Slow and steady: the fill takes a couple of seconds to earn the completion.
export const HOLD_MS = 2000;
const DRIFT_PX = 14;
const PULSE_EVERY_MS = 150;

/**
 * Press-and-hold state machine for habit circles/cards.
 *
 * Completion is driven by a setTimeout, NOT the animation's onComplete —
 * requestAnimationFrame throttling (hidden tabs, low-power mode) must never
 * be able to block a hold from landing. The fill MotionValue is purely
 * visual. While held, a soft haptic pulse repeats until release or landing.
 * Early release, pointer cancel, or >14px drift cancels the hold.
 */
export function useHoldToComplete({
  onFire,
  disabled = false,
}: {
  onFire: () => void;
  disabled?: boolean;
}) {
  const fill = useMotionValue(0);
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const pulse = useRef<number | null>(null);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const settle = useCallback(
    (fired: boolean) => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      if (pulse.current !== null) {
        window.clearInterval(pulse.current);
        pulse.current = null;
      }
      stopVibration();
      anim.current?.stop();
      anim.current = null;
      origin.current = null;
      setHolding(false);
      if (fired) {
        // Hold the full disc a beat; the completed styling takes over from data.
        fill.set(1);
        window.setTimeout(() => fill.set(0), 350);
      } else {
        anim.current = animate(fill, 0, { duration: 0.18, ease: "easeOut" });
      }
    },
    [fill],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (disabled || !e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort
    }
    origin.current = { x: e.clientX, y: e.clientY };
    setHolding(true);
    initAudio(); // unlock inside the user gesture (iOS requirement)
    vibrate(12);
    // Steady heartbeat under the finger for the whole hold.
    pulse.current = window.setInterval(() => vibrate(9), PULSE_EVERY_MS);
    anim.current?.stop();
    anim.current = animate(fill, 1, { duration: HOLD_MS / 1000, ease: "linear" });
    timer.current = window.setTimeout(() => {
      settle(true);
      onFire();
    }, HOLD_MS);
  };

  const cancel = useCallback(() => {
    if (origin.current) settle(false);
  }, [settle]);

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!origin.current) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    if (dx * dx + dy * dy > DRIFT_PX * DRIFT_PX) settle(false);
  };

  return {
    fill,
    holding,
    handlers: {
      onPointerDown,
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onPointerMove,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
