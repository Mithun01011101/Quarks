import { useEffect, useRef, useState } from "react";
import { motion, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import type { TodayHabit } from "@shared/schema";
import { HOLD_MS, useHoldToComplete } from "@/hooks/use-hold-to-complete";
import { BurstCelebration, burstSeedFor } from "@/components/burst-celebration";
import { BoltBadge } from "@/components/badges";
import { HoldFill } from "@/components/hold-fill";
import { playComplete } from "@/lib/audio";
import { hapticSuccess, hapticTick } from "@/lib/settings";
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

  const { fill, fillValues, holding, handlers } = useHoldToComplete({
    disabled: habit.status === "skipped",
    onFire: () => {
      suppressTap.current = true;
      if (!done) {
        playComplete();
        hapticSuccess();
        setBurstSeed(burstSeedFor(habit.id));
        setPop(true);
      } else {
        hapticTick();
      }
      onToggle(habit);
    },
  });

  // A soft halo in the habit's colour that brightens with the hold. Its
  // shadow never changes — only its opacity does (cheap for the phone to
  // draw, unlike re-blurring a box-shadow every frame).
  const halo = useTransform([fill, fillValues.opacity], ([p, o]: number[]) => p * o);

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
      {/* Held: the pebble gives under the thumb at once, then keeps sinking
          slowly for the whole hold. Landed: it springs back up from wherever
          it is (null = current scale, so no jump) with a soft overshoot. Let
          go early: it eases back to rest. The halo scales with it, so no gap
          opens between the two. */}
      <motion.div
        className="relative"
        animate={{
          scale: holding ? 0.965 : pop ? [null, 1.06, 0.985, 1.012, 1] : 1,
        }}
        transition={
          holding
            ? { duration: HOLD_MS / 1000 - 0.1, ease: [0.22, 1, 0.36, 1] }
            : pop
              ? {
                  duration: 0.6,
                  times: [0, 0.32, 0.62, 0.84, 1],
                  ease: "easeInOut",
                }
              : { type: "spring", stiffness: 520, damping: 32 }
        }
        onAnimationComplete={() => setPop(false)}
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[96px]"
          style={{
            opacity: halo,
            boxShadow: `0 0 36px ${quarkHsl(habit.color, 0.4)}`,
          }}
        />
        <button
          type="button"
          aria-label={label}
          className={cn(
            // The pre-redesign card's layout scaled up ~20% (owner: "make the
            // bubbles bigger"): a 240px body inside the border, so a card is
            // 242px, taller when at risk (2px border + the bottom "don't miss
            // twice" line) or when its words wrap. Keep the badge row out of the
            // flow so it never moves the text.
            "relative block w-full overflow-hidden rounded-[96px] border text-center select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            done ? "border-q-done-border bg-q-done" : "border-border/80 bg-card",
            atRisk && "border-2 border-dashed border-q-amber-line",
          )}
          style={{
            touchAction: "pan-y",
            WebkitUserSelect: "none",
            userSelect: "none",
            WebkitTouchCallout: "none",
          }}
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
          {/* the habit's colour spreading from the thumb while held (visual only) */}
          <HoldFill values={fillValues} color={quarkHsl(habit.color, 0.9)} />

          {/* streak badge — top centre, where the old "…" button sat */}
          <span className="absolute inset-x-0 top-5 z-10 flex justify-center gap-1.5">
            {done && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
                <Check size={17} strokeWidth={3} aria-hidden />
              </span>
            )}
            <BoltBadge count={habit.streak.current} size="lg" />
          </span>

          <span className="relative z-[5] flex min-h-[240px] flex-col items-center justify-center gap-2.5 px-8 py-14">
            <span className="font-display text-4xl leading-tight">{habit.name}</span>
            <span className="pt-1 text-sm text-muted-foreground">{copy.cardIntro}</span>
            <span className="font-display text-[22px] leading-snug">{habit.identity}</span>
            {atRisk && (
              <span className="pt-2 text-[13px] font-semibold uppercase tracking-wide text-q-amber">
                Don't miss twice
              </span>
            )}
          </span>
        </button>
      </motion.div>
    </div>
  );
}
