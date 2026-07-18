import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BurstCelebration } from "@/components/burst-celebration";
import { playMilestone } from "@/lib/audio";
import { vibrate } from "@/lib/settings";

const CAPTIONS: Record<number, string> = {
  7: "One full week. It's becoming who you are.",
  14: "Two weeks of showing up.",
  30: "Thirty days. This is a system now.",
  60: "Sixty days deep.",
  100: "One hundred. Quiet consistency.",
  180: "Half a year of votes for this identity.",
  365: "A full year. Remarkable.",
};

export function MilestoneOverlay({
  milestone,
  colorKey,
  onDone,
}: {
  milestone: number | null;
  colorKey: string;
  onDone: () => void;
}) {
  useEffect(() => {
    if (milestone === null) return;
    playMilestone();
    vibrate([30, 40, 30, 40, 60]);
    const t = window.setTimeout(onDone, 2400);
    return () => window.clearTimeout(t);
  }, [milestone, onDone]);

  return (
    <AnimatePresence>
      {milestone !== null && (
        <motion.button
          type="button"
          aria-label="Dismiss celebration"
          className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-background/70 px-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDone}
        >
          <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl bg-charcoal px-6 py-8 text-charcoal-foreground shadow-2xl">
            <p className="flex items-center gap-1.5 self-start text-xs font-semibold text-charcoal-foreground/80">
              <span className="text-q-gold">✦</span> Milestone
            </p>
            <div className="relative flex h-40 w-40 items-center justify-center">
              <BurstCelebration
                colorKey={colorKey}
                seed={milestone * 7919}
                variant="milestone"
                onDone={() => {}}
              />
              <motion.p
                className="font-display text-8xl font-medium tabular-nums"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [0.4, 1.12, 1], opacity: 1 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              >
                {milestone}
              </motion.p>
            </div>
            <p className="text-sm font-medium text-charcoal-foreground/70">day streak</p>
            <p className="max-w-[260px] text-center font-display text-lg italic leading-snug">
              {CAPTIONS[milestone] ?? "Another milestone down."}
            </p>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
