import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Habit } from "@shared/schema";
import { queryKeys } from "@/lib/api";
import { notify } from "@/hooks/use-notifications";

/**
 * Schedules habit reminders while the app is open (no service worker /
 * push backend — Stacks convention; the Settings copy says so honestly).
 * Timers are recomputed whenever habits change or the tab becomes visible.
 */
export function useReminders() {
  const { data: habits } = useQuery<Habit[]>({ queryKey: queryKeys.habits() });

  useEffect(() => {
    if (!habits || !("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    let timers: number[] = [];

    const schedule = () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers = [];
      const now = new Date();
      const weekday = String(now.getDay());

      for (const habit of habits) {
        if (habit.pausedOn || !habit.reminderTimes) continue;
        if (!habit.scheduleDays.includes(weekday)) continue;
        for (const time of habit.reminderTimes.split(",")) {
          const [h, m] = time.trim().split(":").map(Number);
          if (Number.isNaN(h) || Number.isNaN(m)) continue;
          const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
          const delay = at.getTime() - Date.now();
          if (delay <= 0 || delay > 12 * 60 * 60 * 1000) continue;
          timers.push(
            window.setTimeout(() => {
              notify("Quarks", `${habit.name} — ${habit.tinyVersion || habit.action}`);
            }, delay),
          );
        }
      }
    };

    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [habits]);
}
