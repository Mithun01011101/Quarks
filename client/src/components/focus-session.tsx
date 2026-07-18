import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Pause, Play, X } from "lucide-react";
import type { TodayHabit } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api, queryKeys } from "@/lib/api";
import { localToday } from "@/lib/dates";
import { habitSentence } from "@/lib/sentence";
import { playMilestone } from "@/lib/audio";
import { vibrate } from "@/lib/settings";
import { quarkHsl } from "@/lib/colors";

const R = 110;
const CIRCUMFERENCE = 2 * Math.PI * R;

function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Full-screen focus countdown. Time is computed from a wall-clock deadline
 * (endsAt − now), never a decrementing counter — background throttling can't
 * drift it. A 500ms interval backs up the rAF loop for the same reason.
 */
export function FocusSession({
  habit,
  sessionId,
  durationMinutes,
  onExit,
}: {
  habit: TodayHabit;
  sessionId: number;
  durationMinutes: number;
  onExit: () => void;
}) {
  const totalSeconds = durationMinutes * 60;
  const today = localToday();
  const queryClient = useQueryClient();

  const [remaining, setRemaining] = useState(totalSeconds);
  const [paused, setPaused] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [autoLog, setAutoLog] = useState(true);
  const [finished, setFinished] = useState(false);

  const endsAt = useRef(Date.now() + totalSeconds * 1000);
  const pausedRemaining = useRef<number | null>(null);
  const rafId = useRef<number>(0);
  const finishedRef = useRef(false);
  const autoLogRef = useRef(true);
  autoLogRef.current = autoLog;
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.today(today) });
    queryClient.invalidateQueries({ queryKey: queryKeys.progress(today) });
    queryClient.invalidateQueries({ queryKey: queryKeys.focusSessions() });
  }, [queryClient, today]);

  const complete = useMutation({
    mutationFn: async () => {
      await api.updateFocusSession(sessionId, {
        secondsFocused: totalSeconds,
        completed: true,
        ended: true,
        date: today,
      });
      if (autoLogRef.current && habit.status !== "done") {
        await api.complete(habit.id, { date: today, source: "focus" });
      }
    },
    onSettled: refresh,
  });

  const abandon = useMutation({
    mutationFn: async () => {
      const elapsed = totalSeconds - Math.max(0, remainingNow());
      await api.updateFocusSession(sessionId, {
        secondsFocused: Math.max(0, Math.round(elapsed)),
        completed: false,
        ended: true,
        date: today,
      });
    },
    onSettled: () => {
      refresh();
      onExit();
    },
  });

  const remainingNow = useCallback((): number => {
    if (pausedRemaining.current !== null) return pausedRemaining.current;
    return Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    setRemaining(0);
    playMilestone();
    vibrate([40, 60, 40]);
    complete.mutate();
    window.setTimeout(onExit, 1800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const update = () => {
      const r = remainingNow();
      setRemaining(r);
      if (r <= 0 && pausedRemaining.current === null) finish();
    };
    const loop = () => {
      update();
      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);
    const interval = window.setInterval(update, 500);
    const onVis = () => update();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(rafId.current);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [remainingNow, finish]);

  // Best-effort screen wake lock while the session runs.
  useEffect(() => {
    let released = false;
    const acquire = async () => {
      try {
        const wl = await (navigator as any).wakeLock?.request?.("screen");
        if (wl && !released) wakeLock.current = wl;
      } catch {
        // unsupported or denied — fine
      }
    };
    void acquire();
    const onVis = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVis);
      void wakeLock.current?.release?.().catch(() => {});
    };
  }, []);

  const togglePause = () => {
    if (finishedRef.current) return;
    if (paused) {
      endsAt.current = Date.now() + (pausedRemaining.current ?? 0) * 1000;
      pausedRemaining.current = null;
      setPaused(false);
    } else {
      pausedRemaining.current = remainingNow();
      setPaused(true);
    }
  };

  const progress = 1 - remaining / totalSeconds;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background px-6">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {finished ? "Session complete" : paused ? "Paused" : "Focusing on"}
      </p>

      <div className="relative">
        <motion.svg
          width={R * 2 + 20}
          height={R * 2 + 20}
          viewBox={`0 0 ${R * 2 + 20} ${R * 2 + 20}`}
          animate={
            finished || paused ? { scale: 1 } : { scale: [1, 1.02, 1] }
          }
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle
            cx={R + 10}
            cy={R + 10}
            r={R}
            fill="none"
            stroke={quarkHsl(habit.color, 0.15)}
            strokeWidth={6}
          />
          <circle
            cx={R + 10}
            cy={R + 10}
            r={R}
            fill="none"
            stroke={quarkHsl(habit.color, 0.9)}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            transform={`rotate(-90 ${R + 10} ${R + 10})`}
          />
        </motion.svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-5xl font-medium tabular-nums">{mmss(remaining)}</p>
          <p className="pt-1 text-sm text-muted-foreground">{habit.name}</p>
        </div>
      </div>

      <p className="max-w-xs text-center font-display text-sm italic leading-snug text-foreground/70">
        “{habitSentence(habit)}”
      </p>

      {!finished && (
        <>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="icon" onClick={togglePause} aria-label={paused ? "Resume" : "Pause"}>
              {paused ? <Play /> : <Pause />}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (remaining <= 0) return;
                setConfirmEnd(true);
              }}
            >
              <X /> End session
            </Button>
          </div>
          {habit.status !== "done" && (
            <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Switch checked={autoLog} onCheckedChange={setAutoLog} />
              Log {habit.name} when finished
            </label>
          )}
        </>
      )}
      {finished && (
        <p className="font-display text-base italic text-q-sage">
          {autoLog && habit.status !== "done" ? `${habit.name} logged.` : "Well held."}
        </p>
      )}

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this session early?</AlertDialogTitle>
            <AlertDialogDescription>
              {mmss(totalSeconds - remaining)} of focus so far — it'll be saved,
              but the session won't count as finished.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction onClick={() => abandon.mutate()}>End session</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
