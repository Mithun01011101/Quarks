import { useRef, useState } from "react";
import { motion, useTransform } from "framer-motion";
import { Check, MoreHorizontal, Zap } from "lucide-react";
import type { TodayHabit } from "@shared/schema";
import { useHoldToComplete } from "@/hooks/use-hold-to-complete";
import { BurstCelebration } from "@/components/burst-celebration";
import { HabitCircle } from "@/components/habit-circle";
import { playComplete } from "@/lib/audio";
import { vibrate } from "@/lib/settings";
import { quarkColor, quarkHsl } from "@/lib/colors";
import { kindCopy } from "@/lib/sentence";
import { cn } from "@/lib/utils";

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

function BoltBadge({ count, small = false }: { count: number; small?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "bolt-badge flex flex-col items-center justify-center rounded-2xl text-white shadow-sm",
        small ? "min-w-9 flex-row gap-1 rounded-xl px-2 py-1" : "min-w-12 gap-0.5 px-3 py-2",
      )}
    >
      <Zap size={small ? 12 : 15} fill="currentColor" strokeWidth={0} />
      <span className={cn("font-semibold tabular-nums", small ? "text-xs" : "text-sm")}>
        {count}
      </span>
    </span>
  );
}

/**
 * The Today habit card — a big soft squircle you press and hold anywhere to
 * complete. touch-action stays pan-y so the page still scrolls; a moving
 * finger cancels the hold. Tap (or the … chip) opens the habit sheet.
 */
export function HabitCard({
  habit,
  onToggle,
  onTap,
  compact = false,
}: {
  habit: TodayHabit;
  onToggle: (habit: TodayHabit) => void;
  onTap: (habit: TodayHabit) => void;
  compact?: boolean;
}) {
  const color = quarkColor(habit.color);
  const done = habit.status === "done";
  const skipped = habit.status === "skipped";
  const atRisk = habit.streak.atRisk && !done;

  const [burstSeed, setBurstSeed] = useState<number | null>(null);
  const [pop, setPop] = useState(false);
  const suppressTap = useRef(false);
  const downAt = useRef(0);

  const { fill, holding, handlers } = useHoldToComplete({
    disabled: skipped,
    onFire: () => {
      suppressTap.current = true;
      if (!done) {
        playComplete();
        vibrate(35);
        setBurstSeed(habit.id * 10007 + dayOfYear());
        setPop(true);
      } else {
        vibrate(15);
      }
      onToggle(habit);
    },
  });

  const glow = useTransform(fill, (v) => `0 0 ${Math.round(36 * v)}px ${quarkHsl(habit.color, 0.35 * v)}`);

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-3xl border bg-card px-4 py-2.5",
          atRisk ? "border-dashed border-q-gold/70" : "border-border/70",
          !habit.scheduledToday && !done && "opacity-60",
        )}
      >
        <HabitCircle habit={habit} size="sm" onToggle={onToggle} onTap={onTap} />
        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer text-left"
          onClick={() => onTap(habit)}
        >
          <p className={cn("truncate font-display text-base", done && "line-through decoration-1 opacity-60")}>
            {habit.name}
          </p>
          {atRisk && <p className="text-[11px] font-medium text-q-gold">don't miss twice</p>}
        </button>
        <BoltBadge count={habit.totalReps} small />
      </div>
    );
  }

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
        aria-label={`${habit.name} — ${done ? "hold to undo" : kindCopy(habit.kind).holdLabel}`}
        className={cn(
          "relative block w-full overflow-hidden rounded-[5rem] border text-center select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          done ? "border-transparent" : "border-border/70 bg-card shadow-sm",
          atRisk && "border-2 border-dashed border-q-gold/80",
          skipped && "border-dashed opacity-70",
          !habit.scheduledToday && !done && "opacity-60",
        )}
        style={{
          touchAction: "pan-y",
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
          // Completed = ONE uniform calm pebble for every habit (round 3), not
          // a per-habit tint. Theme-aware via the --q-done token.
          backgroundColor: done ? "hsl(var(--q-done))" : undefined,
          borderColor: done ? "hsl(var(--q-done-border))" : undefined,
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

        {/* … chip (opens the sheet without starting a hold) */}
        <span
          role="button"
          aria-label={`${habit.name} options`}
          tabIndex={-1}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onTap(habit);
          }}
          className="absolute left-1/2 top-4 z-10 flex h-7 w-11 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full bg-secondary text-muted-foreground"
        >
          <MoreHorizontal size={16} />
        </span>

        {/* repetition badge */}
        <span className="absolute right-4 top-4 z-10">
          <BoltBadge count={habit.totalReps} />
        </span>

        <span className="relative z-[5] flex min-h-[200px] flex-col items-center justify-center gap-2 px-8 py-12">
          {done && (
            <Check
              size={30}
              strokeWidth={3}
              className="mb-1"
              style={{ color: "hsl(var(--foreground))" }}
            />
          )}
          {skipped && (
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Skipped today
            </span>
          )}
          <span className="font-display text-3xl leading-tight">
            {habit.name}
          </span>
          <span className="pt-1 text-xs text-muted-foreground">
            {kindCopy(habit.kind).cardIntro}
          </span>
          <span className="font-display text-lg leading-snug text-foreground/90">
            {habit.identity}
          </span>
          {atRisk && (
            <span className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-q-gold">
              Don't miss twice
            </span>
          )}
        </span>
      </motion.button>
    </div>
  );
}
