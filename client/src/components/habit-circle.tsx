import { useRef, useState } from "react";
import { motion, useTransform } from "framer-motion";
import { Check, Minus, icons } from "lucide-react";
import type { TodayHabit } from "@shared/schema";
import { useHoldToComplete } from "@/hooks/use-hold-to-complete";
import { BurstCelebration } from "@/components/burst-celebration";
import { playComplete } from "@/lib/audio";
import { vibrate } from "@/lib/settings";
import { quarkColor, quarkHsl } from "@/lib/colors";
import { cn } from "@/lib/utils";

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

const SIZES = { lg: 96, sm: 44 } as const;

/**
 * The signature component. Tap opens the habit sheet; press-and-hold ~700ms
 * fills the circle and completes the habit (or undoes it, quietly). The
 * burst, chime, and haptics fire here so the reward lands instantly —
 * persistence happens in the parent's mutation.
 */
export function HabitCircle({
  habit,
  size = "lg",
  onToggle,
  onTap,
}: {
  habit: TodayHabit;
  size?: keyof typeof SIZES;
  onToggle: (habit: TodayHabit) => void;
  onTap?: (habit: TodayHabit) => void;
}) {
  const px = SIZES[size];
  const color = quarkColor(habit.color);
  const done = habit.status === "done";
  const skipped = habit.status === "skipped";
  const dimmed = !habit.scheduledToday && !done;

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

  const glow = useTransform(fill, (v) => `0 0 ${Math.round(28 * v)}px ${quarkHsl(habit.color, 0.4 * v)}`);
  const LucideIcon = habit.icon ? icons[habit.icon as keyof typeof icons] : null;
  const iconSize = size === "lg" ? 28 : 16;

  return (
    <div className="relative" style={{ width: px, height: px }}>
      {burstSeed !== null && (
        <BurstCelebration
          colorKey={habit.color}
          seed={burstSeed}
          onDone={() => setBurstSeed(null)}
        />
      )}
      <motion.button
        type="button"
        aria-label={`${habit.name} — ${done ? "hold to undo" : "hold to complete"}`}
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-full border-2 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          skipped && "border-dashed",
          dimmed && "opacity-50",
        )}
        style={{
          width: px,
          height: px,
          touchAction: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
          borderColor: done
            ? "hsl(var(--q-done-border))"
            : habit.streak.atRisk
              ? quarkHsl("gold", 0.9)
              : quarkHsl(habit.color, 0.45),
          borderStyle: habit.streak.atRisk && !done ? "dashed" : skipped ? "dashed" : "solid",
          boxShadow: glow as unknown as string,
        }}
        animate={{ scale: holding ? 0.96 : pop ? [0.96, 1.14, 0.98, 1] : 1 }}
        transition={
          pop
            ? { duration: 0.45, times: [0, 0.3, 0.68, 1], ease: "easeOut" }
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
          // A pointer press longer than a tap was a failed hold, not a tap.
          // pressedAt === 0 means keyboard/assistive activation — always a tap.
          if (pressedAt !== 0 && Date.now() - pressedAt > 320) return;
          onTap?.(habit);
        }}
      >
        {/* soft tint */}
        <span className={cn("absolute inset-0 rounded-full", color.bgSoft)} />
        {/* fill disc while holding (visual only) */}
        <motion.span
          className={cn("absolute inset-0 rounded-full", color.bg)}
          style={{ scale: fill }}
        />
        {/* settled completed disc — ONE uniform neutral for every habit (round 3) */}
        {done && (
          <span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: "hsl(var(--q-done))" }}
          />
        )}
        {/* content */}
        <span className="relative z-10 text-primary-foreground">
          {done ? (
            <Check size={iconSize} strokeWidth={3} style={{ color: "hsl(var(--foreground))" }} />
          ) : skipped ? (
            <Minus size={iconSize} className="text-muted-foreground" />
          ) : LucideIcon ? (
            <LucideIcon size={iconSize} className={color.text} strokeWidth={2} />
          ) : (
            <span className={cn("font-display", size === "lg" ? "text-2xl" : "text-sm", color.text)}>
              {habit.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
      </motion.button>
    </div>
  );
}
