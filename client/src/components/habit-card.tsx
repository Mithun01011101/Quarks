import { useEffect, useRef, useState } from "react";
import { motion, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import type { TodayHabit } from "@shared/schema";
import { useHoldToComplete } from "@/hooks/use-hold-to-complete";
import { BurstCelebration, burstSeedFor } from "@/components/burst-celebration";
import { BoltBadge } from "@/components/badges";
import { playComplete } from "@/lib/audio";
import { vibrate } from "@/lib/settings";
import { quarkHsl } from "@/lib/colors";
import { kindCopy, streakLabel } from "@/lib/sentence";
import { cn } from "@/lib/utils";

/** A completion that started elsewhere (the options sheet) but celebrates here. */
export type Celebration = { seed: number; at: number };

/** Only a fresh celebration plays — never a stale one on a later re-mount. */
export function isFreshCelebration(c?: Celebration): c is Celebration {
  return !!c && Date.now() - c.at < 600;
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The Today habit card — a pebble you press and hold anywhere to complete.
 * touch-action stays pan-y so the page still scrolls; a moving finger cancels
 * the hold. A quick tap opens the habit's options sheet.
 */
export function HabitCard({
  habit,
  onToggle,
  onTap,
  celebrate,
}: {
  habit: TodayHabit;
  onToggle: (habit: TodayHabit) => void;
  onTap: (habit: TodayHabit) => void;
  celebrate?: Celebration;
}) {
  const done = habit.status === "done";
  const atRisk = habit.streak.atRisk && !done;
  const copy = kindCopy(habit.kind);

  const [burstSeed, setBurstSeed] = useState<number | null>(null);
  const [pop, setPop] = useState(false);
  const suppressTap = useRef(false);
  const downAt = useRef(0);

  useEffect(() => {
    if (!isFreshCelebration(celebrate)) return;
    setBurstSeed(celebrate.seed);
    setPop(true);
  }, [celebrate?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const { fill, holding, handlers } = useHoldToComplete({
    disabled: habit.status === "skipped",
    onFire: () => {
      suppressTap.current = true;
      if (!done) {
        playComplete();
        vibrate(35);
        setBurstSeed(burstSeedFor(habit.id));
        setPop(true);
      } else {
        vibrate(15);
      }
      onToggle(habit);
    },
  });

  const glow = useTransform(
    fill,
    (v) => `0 0 ${Math.round(36 * v)}px ${quarkHsl(habit.color, 0.35 * v)}`,
  );

  const streak = streakLabel(habit.streak.current);
  const label = done
    ? `${habit.name}, done, ${streak}. Hold to undo, or tap for options.`
    : `${habit.name}, ${streak}${atRisk ? ", missed last time: don't miss twice" : ""}. ${sentenceCase(copy.holdLabel)}, or tap for options.`;

  return (
    <div className="relative">
      {burstSeed !== null && (
        <BurstCelebration
          colorKey={habit.color}
          seed={burstSeed}
          spread={180}
          onDone={() => setBurstSeed(null)}
        />
      )}
      <motion.button
        type="button"
        aria-label={label}
        className={cn(
          // Geometry is the pre-redesign card's, measured to the pixel (owner's
          // choice): the text sits in a 200px body inside the border, so a card
          // is 202px — 231px when at risk (2px border + the bottom "don't miss
          // twice" line) — and taller only when its words wrap. Keep the badge
          // row out of the flow so it never moves the text.
          "relative block w-full overflow-hidden rounded-[80px] border text-center select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          done ? "border-q-done-border bg-q-done" : "border-border/80 bg-card",
          atRisk && "border-2 border-dashed border-q-amber-line",
        )}
        style={{
          touchAction: "pan-y",
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
          boxShadow: glow as unknown as string,
        }}
        animate={{ scale: holding ? 0.98 : pop ? [0.92, 1.12, 0.97, 1.03, 1] : 1 }}
        transition={
          pop
            ? { duration: 0.62, times: [0, 0.26, 0.52, 0.76, 1], ease: "easeOut" }
            : { duration: 0.15 }
        }
        onAnimationComplete={() => setPop(false)}
        {...handlers}
        onPointerDownCapture={() => {
          downAt.current = Date.now();
        }}
        onClick={() => {
          if (suppressTap.current) {
            suppressTap.current = false;
            downAt.current = 0;
            return;
          }
          const pressedAt = downAt.current;
          downAt.current = 0;
          // A press longer than a tap was an abandoned hold, not a tap.
          // pressedAt === 0 means keyboard/assistive activation — always a tap.
          if (pressedAt !== 0 && Date.now() - pressedAt > 320) return;
          onTap(habit);
        }}
      >
        {/* radial fill while holding (visual only) */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ backgroundColor: quarkHsl(habit.color, 0.9), scale: fill }}
        />

        {/* streak badge — in the slot the old "…" button had (top 16px, 28px tall) */}
        <span className="absolute inset-x-0 top-4 z-10 flex justify-center gap-1.5">
          {done && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background">
              <Check size={15} strokeWidth={3} aria-hidden />
            </span>
          )}
          <BoltBadge count={habit.streak.current} />
        </span>

        <span className="relative z-[5] flex min-h-[200px] flex-col items-center justify-center gap-2 px-8 py-12">
          <span className="font-display text-3xl leading-tight">{habit.name}</span>
          <span className="pt-1 text-xs text-muted-foreground">{copy.cardIntro}</span>
          <span className="font-display text-lg leading-snug">{habit.identity}</span>
          {atRisk && (
            <span className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-q-amber">
              Don't miss twice
            </span>
          )}
        </span>
      </motion.button>
    </div>
  );
}
