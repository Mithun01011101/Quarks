import { useCallback, useEffect, useRef, useState } from "react";
import {
  animate,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";
import { initAudio } from "@/lib/audio";
import { stopVibration, vibrate } from "@/lib/settings";

// Slow and steady: the fill takes a couple of seconds to earn the completion.
export const HOLD_MS = 2000;
/** A press only becomes a hold (colour + hum) after this long, so quick taps
 *  (open the sheet) and scroll flicks that start on a bubble stay quiet. */
export const INTENT_MS = 110;
const DRIFT_PX = 14;

/** What a HoldFill needs to draw the colour spreading out from the thumb. */
export type HoldFillValues = {
  /** Diameter of the fill disc (px) — big enough to reach the far edge. */
  size: MotionValue<number>;
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  opacity: MotionValue<number>;
};

function insideRoundedRect(x: number, y: number, w: number, h: number, r: number) {
  const cx = x < r ? r : x > w - r ? w - r : x;
  const cy = y < r ? r : y > h - r ? h - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/**
 * Radii that make the fill cover the bubble EVENLY: entry k is the radius at
 * which k/n of the bubble (a w×h pebble with corner radius r) lies within the
 * disc around the press point. Reading it at the hold's progress makes the
 * coloured AREA grow at a steady rate — no slow start, no rush into the last
 * corner — and the last entry is the shape's farthest point, so the disc
 * lands on the final edge exactly when the hold does.
 */
export function coverageRadii(w: number, h: number, r: number, ox: number, oy: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const cols = 40;
  const step = w / cols;
  const rows = Math.max(6, Math.round(h / step));
  const stepY = h / rows;
  const d: number[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = (i + 0.5) * step;
      const y = (j + 0.5) * stepY;
      if (insideRoundedRect(x, y, w, h, r)) d.push(Math.hypot(x - ox, y - oy));
    }
  }
  d.sort((a, b) => a - b);
  let far = 0;
  for (const [cx, cy] of [
    [r, r],
    [w - r, r],
    [r, h - r],
    [w - r, h - r],
  ]) {
    far = Math.max(far, Math.hypot(cx - ox, cy - oy) + r);
  }
  return Float32Array.from([0, ...d, far]);
}

export function radiusAt(table: Float32Array, p: number) {
  const n = table.length - 1;
  if (n < 1) return 0;
  const f = Math.min(Math.max(p, 0), 1) * n;
  const i = Math.floor(f);
  return i >= n ? table[n] : table[i] + (table[i + 1] - table[i]) * (f - i);
}

/**
 * Press-and-hold state machine for habit cards and rows.
 *
 * Completion is driven by a setTimeout, NOT the animation's onComplete —
 * requestAnimationFrame throttling (hidden tabs, low-power mode) must never
 * be able to block a hold from landing. Everything visual is cosmetic.
 *
 * The feel (owner, 2026-10-07: "smoother and even"): after INTENT_MS the
 * habit's colour spreads from under the thumb at a steady rate while ONE
 * unbroken vibration hums (it used to be 9 ms taps every 150 ms — "dotted").
 * On landing the hum stops and the caller plays its own reward haptic; the
 * colour then fades into the done look instead of vanishing in one frame.
 * Early release, pointer cancel, or >14px drift cancels: the hum stops at
 * once and the colour drains back into the thumb.
 */
export function useHoldToComplete({
  onFire,
  disabled = false,
}: {
  onFire: () => void;
  disabled?: boolean;
}) {
  /** 0 → 1 over the hold, linear in time (also drives HabitCard's halo). */
  const fill = useMotionValue(0);
  const opacity = useMotionValue(1);
  const size = useMotionValue(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const table = useRef<Float32Array>(new Float32Array([0, 0]));
  const scale = useTransform(fill, (p) => {
    const half = size.get() / 2;
    return half > 0 ? radiusAt(table.current, p) / half : 0;
  });

  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const intent = useRef<number | null>(null);
  const anims = useRef<AnimationPlaybackControls[]>([]);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const stopAnims = () => {
    anims.current.forEach((a) => a.stop());
    anims.current = [];
  };

  const clearTimers = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (intent.current !== null) window.clearTimeout(intent.current);
    timer.current = null;
    intent.current = null;
  };

  const settle = useCallback(
    (fired: boolean) => {
      clearTimers();
      stopVibration();
      stopAnims();
      origin.current = null;
      setHolding(false);
      if (fired) {
        // Show the full colour a beat, then let it melt into the done look
        // (the completed styling underneath comes from data).
        fill.set(1);
        anims.current = [
          animate(opacity, 0, {
            delay: 0.16,
            duration: 0.45,
            ease: "easeInOut",
            onComplete: () => {
              fill.set(0);
              opacity.set(1);
            },
          }),
        ];
      } else {
        anims.current = [animate(fill, 0, { duration: 0.24, ease: "easeOut" })];
      }
    },
    [fill, opacity],
  );

  // Never leave a hum running or a timer pending if the bubble unmounts.
  useEffect(
    () => () => {
      if (origin.current) stopVibration();
      clearTimers();
    },
    [],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (disabled || !e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort
    }
    clearTimers();
    stopAnims();
    origin.current = { x: e.clientX, y: e.clientY };
    setHolding(true);
    initAudio(); // unlock inside the user gesture (iOS requirement)

    // Where the thumb is, in the bubble's own (unscaled) coordinates.
    const rect = el.getBoundingClientRect();
    const w = el.offsetWidth || rect.width;
    const h = el.offsetHeight || rect.height;
    const k = rect.width > 0 ? w / rect.width : 1;
    const ox = Math.min(Math.max((e.clientX - rect.left) * k, 0), w);
    const oy = Math.min(Math.max((e.clientY - rect.top) * k, 0), h);
    const corner = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    table.current = coverageRadii(w, h, corner, ox, oy);
    const d = 2 * table.current[table.current.length - 1];
    fill.set(0);
    opacity.set(1);
    size.set(d);
    x.set(ox - d / 2);
    y.set(oy - d / 2);

    // After a beat it's clearly a hold: colour and hum start together and
    // both run until the moment it lands.
    intent.current = window.setTimeout(() => {
      intent.current = null;
      const left = HOLD_MS - INTENT_MS;
      vibrate(left);
      anims.current = [animate(fill, 1, { duration: left / 1000, ease: "linear" })];
    }, INTENT_MS);
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

  const fillValues: HoldFillValues = { size, x, y, scale, opacity };

  return {
    fill,
    fillValues,
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
