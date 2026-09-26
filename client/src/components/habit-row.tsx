import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Flame, Minus, icons } from "lucide-react";
import type { TodayHabit } from "@shared/schema";
import { useHoldToComplete } from "@/hooks/use-hold-to-complete";
import { BurstCelebration, burstSeedFor } from "@/components/burst-celebration";
import { BoltBadge } from "@/components/badges";
import { isFreshCelebration, type Celebration } from "@/components/habit-card";
import { playComplete } from "@/lib/audio";
import { vibrate } from "@/lib/settings";
import { quarkColor, quarkHsl, quarkInkVar } from "@/lib/colors";
import { cueLabel, daysShort } from "@/lib/sentence";
import { cn } from "@/lib/utils";

/**
 * compact — a to-do habit in Compact view (72px: icon, name, cue, badge)
 * done    — the slim row in the Done list (hold to undo)
 * skipped — skipped for the day (no hold; tap for options)
 * offday  — not scheduled that day (can still be held to log a bonus rep)
 */
export type RowVariant = "compact" | "done" | "skipped" | "offday";

/**
 * A slim habit row. The whole row is the hold target (same 2 s hold as the
 * big card) and a quick tap opens the habit's options sheet.
 */
export function HabitRow({
  habit,
  variant,
  onToggle,
  onTap,
  celebrate,
}: {
  habit: TodayHabit;
  variant: RowVariant;
  onToggle: (habit: TodayHabit) => void;
  onTap: (habit: TodayHabit) => void;
  celebrate?: Celebration;
}) {
  const color = quarkColor(habit.color);
  const done = habit.status === "done";
  const skipped = habit.status === "skipped";
  const big = variant === "compact";
  const atRisk = big && habit.streak.atRisk && !done;
  const disc = big ? 48 : 40;
  const discLeft = big ? 12 : 10;
  const Icon = habit.icon ? icons[habit.icon as keyof typeof icons] : null;

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
    disabled: skipped,
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

  const glyph = Icon ? (
    <Icon size={big ? 20 : 18} strokeWidth={2} aria-hidden />
  ) : (
    <span className={cn("font-display", big ? "text-lg" : "text-base")}>
      {habit.name.slice(0, 1).toUpperCase()}
    </span>
  );

  let discEl: React.ReactNode;
  if (done) {
    discEl = (
      <span className="flex h-full w-full items-center justify-center rounded-full bg-foreground text-background">
        <Check size={18} strokeWidth={3} aria-hidden />
      </span>
    );
  } else if (skipped) {
    discEl = (
      <span className="flex h-full w-full items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Minus size={18} strokeWidth={2.4} aria-hidden />
      </span>
    );
  } else if (variant === "offday") {
    discEl = (
      <span className="flex h-full w-full items-center justify-center rounded-full border border-border text-muted-foreground">
        {glyph}
      </span>
    );
  } else {
    discEl = (
      <span
        className={cn(
          "q-ink flex h-full w-full items-center justify-center rounded-full border-2",
          color.bgSoft,
        )}
        style={{ ...quarkInkVar(habit.color), borderColor: quarkHsl(habit.color, 0.45) }}
      >
        {glyph}
      </span>
    );
  }

  let trailing: React.ReactNode = null;
  if (variant === "skipped") {
    trailing = <span className="text-xs font-medium text-muted-foreground">Skipped</span>;
  } else if (variant === "offday") {
    trailing = (
      <span className="text-xs font-medium text-muted-foreground">
        {daysShort(habit.scheduleDays)}
      </span>
    );
  } else {
    trailing = <BoltBadge count={habit.totalReps} size={big ? "md" : "sm"} />;
  }

  const reps = `${habit.totalReps} ${habit.totalReps === 1 ? "rep" : "reps"}`;
  const label =
    variant === "skipped"
      ? `${habit.name}, skipped. Tap for options.`
      : variant === "offday"
        ? `${habit.name}, not scheduled today (${daysShort(habit.scheduleDays)})${done ? ", done" : ""}. ${done ? "Hold to undo" : "Hold to log a rep anyway"}, or tap for options.`
        : done
          ? `${habit.name}, done, ${reps}. Hold to undo, or tap for options.`
          : `${habit.name}, ${reps}${atRisk ? ", missed last time: don't miss twice" : ""}. Hold to complete, or tap for options.`;

  return (
    <div className="relative">
      {burstSeed !== null && (
        <span
          className="pointer-events-none absolute top-1/2 z-20 -translate-y-1/2"
          style={{ left: discLeft, width: disc, height: disc }}
        >
          <BurstCelebration
            colorKey={habit.color}
            seed={burstSeed}
            spread={110}
            onDone={() => setBurstSeed(null)}
          />
        </span>
      )}
      <motion.button
        type="button"
        aria-label={label}
        className={cn(
          "relative flex w-full items-center overflow-hidden border text-left select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          big ? "h-[72px] gap-3.5 rounded-[36px] pr-3.5" : "h-[60px] gap-3 rounded-[30px] pr-3",
          done
            ? "border-q-done-border bg-q-done"
            : skipped
              ? "border-dashed border-border bg-card/50"
              : variant === "offday"
                ? "border-dashed border-border bg-transparent"
                : "border-border/80 bg-card",
          atRisk && "border-2 border-dashed border-q-amber-line",
        )}
        style={{
          paddingLeft: discLeft - (atRisk ? 1 : 0),
          touchAction: "pan-y",
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
        }}
        animate={{ scale: holding ? 0.98 : pop ? [0.94, 1.06, 0.99, 1] : 1 }}
        transition={
          pop ? { duration: 0.5, times: [0, 0.3, 0.68, 1], ease: "easeOut" } : { duration: 0.15 }
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
          if (pressedAt !== 0 && Date.now() - pressedAt > 320) return;
          onTap(habit);
        }}
      >
        {/* fill radiates from the icon while holding (visual only) */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute top-1/2 aspect-square w-[240%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: discLeft + disc / 2,
            backgroundColor: quarkHsl(habit.color, 0.9),
            scale: fill,
          }}
        />
        <span className="relative z-[5] shrink-0" style={{ width: disc, height: disc }}>
          {discEl}
        </span>
        <span className="relative z-[5] flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              "truncate font-display",
              big ? "text-xl leading-6" : "text-lg leading-[22px]",
              (variant === "offday" || skipped) && !done && "text-muted-foreground",
            )}
          >
            {habit.name}
          </span>
          {big &&
            (atRisk ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-q-amber">
                <Flame size={13} strokeWidth={2.2} aria-hidden /> Don't miss twice
              </span>
            ) : (
              <span className="truncate text-xs text-muted-foreground">{cueLabel(habit)}</span>
            ))}
        </span>
        <span className="relative z-[5] shrink-0">{trailing}</span>
      </motion.button>
    </div>
  );
}
