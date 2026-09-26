import { useEffect, useRef, useState } from "react";
import { motion, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import type { TodayHabit } from "@shared/schema";
import { useHoldToComplete } from "@/hooks/use-hold-to-complete";
import { BurstCelebration, burstSeedFor } from "@/components/burst-celebration";
import { BoltBadge, RiskChip } from "@/components/badges";
import { playComplete } from "@/lib/audio";
import { vibrate } from "@/lib/settings";
import { quarkHsl } from "@/lib/colors";
import { kindCopy } from "@/lib/sentence";
import { cn } from "@/lib/utils";

/** A completion that started elsewhere (the options sheet) but celebrates here. */
export type Celebration = { seed: number; at: number };

/** Only a fresh celebration plays — never a stale one on a later re-mount. */
export function isFreshCelebration(c?: Celebration): c is Celebration {
  return !!c && Date.now() - c.at < 600;
}

/** Long names step down in size so the card keeps its pebble height. */
function nameSize(name: string): string {
  if (name.length > 24) return "text-[22px] leading-[26px]";
  if (name.length > 16) return "text-[26px] leading-[30px]";
  return "text-[30px] leading-[34px]";
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

  const reps = `${habit.totalReps} ${habit.totalReps === 1 ? "rep" : "reps"}`;
  const label = done
    ? `${habit.name}, done, ${reps}. Hold to undo, or tap for options.`
    : `${habit.name}, ${reps}${atRisk ? ", missed last time: don't miss twice" : ""}. ${sentenceCase(copy.holdLabel)}, or tap for options.`;

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
          // 200px tall with 80px corners: the pre-redesign pebble size (owner's choice).
          "relative flex min-h-[200px] w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[80px] border px-8 py-8 text-center select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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

        <span className="relative z-[5] flex items-center gap-1.5">
          {done && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background">
              <Check size={15} strokeWidth={3} aria-hidden />
            </span>
          )}
          <BoltBadge count={habit.totalReps} />
          {atRisk && <RiskChip />}
        </span>
        <span
          className={cn(
            "relative z-[5] line-clamp-2 font-display tracking-[-0.01em]",
            nameSize(habit.name),
          )}
        >
          {habit.name}
        </span>
        <span className="relative z-[5] flex flex-col items-center gap-0.5">
          <span className="text-xs text-muted-foreground">{copy.cardIntro}</span>
          <span className="line-clamp-2 font-display text-[17px] leading-[22px]">
            {habit.identity}
          </span>
        </span>
      </motion.button>
    </div>
  );
}
