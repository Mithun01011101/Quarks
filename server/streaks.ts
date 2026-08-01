import { addDays } from "date-fns";
import type { Completion, Habit, MarkStatus, StreakInfo } from "@shared/schema";

// Streak milestones celebrated in the UI. The /complete endpoint reports one
// when the completion makes the current streak equal one of these.
export const MILESTONES = [7, 14, 30, 60, 100, 180, 365];

// All day logic runs over LOCAL "YYYY-MM-DD" strings supplied by the client.
// Dates are parsed from parts (never Date.parse, which treats "YYYY-MM-DD"
// as UTC) so the server's timezone can never shift a calendar day.
function parseParts(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekdayOf(date: string): number {
  return parseParts(date).getDay(); // 0=Sun..6=Sat
}

export function addDaysStr(date: string, n: number): string {
  return fmtDate(addDays(parseParts(date), n));
}

export function marksFor(completions: Completion[]): Map<string, MarkStatus> {
  const map = new Map<string, MarkStatus>();
  for (const c of completions) {
    map.set(c.date, c.status as MarkStatus);
  }
  return map;
}

// A day is "scheduled" for a habit when its weekday is in scheduleDays, it is
// on/after the habit's start date, and the habit is not paused as of that day.
export function isScheduled(habit: Habit, date: string): boolean {
  if (date < habit.startDate) return false;
  if (habit.pausedOn && date >= habit.pausedOn) return false;
  return habit.scheduleDays.includes(String(weekdayOf(date)));
}

/**
 * Consecutive-day streak, single forward pass from startDate to today.
 *
 * A streak is a run of CONSECUTIVE scheduled days completed — missing a
 * scheduled day ends it. "Don't miss twice" is the nudge (`atRisk`), not an
 * amnesty: it warns after a miss so you come back the next day, but the
 * number itself stays honest.
 *
 * - done                -> run grows
 * - skipped             -> excused and transparent: neither grows nor breaks
 * - today with no mark  -> still in progress, neither grows nor breaks
 * - any other scheduled day with no mark -> miss, run resets to 0
 * - atRisk -> EXACTLY one scheduled miss is outstanding and today isn't done
 *             ("don't miss twice"). Two or more trailing misses means the
 *             streak is already gone, so the nudge would be stale.
 *
 * Completions on unscheduled days count toward totals elsewhere but do not
 * participate in the walk.
 *
 * NOTE: an earlier version forgave a lone miss and only reset after two in a
 * row. That let alternating done/miss/done climb forever, so the "streak"
 * silently became a completion count (5 completions across 8 days reported a
 * 5-day streak). See check-streaks.ts case 13.
 */
export function computeStreak(
  habit: Habit,
  marks: Map<string, MarkStatus>,
  today: string,
): StreakInfo {
  let run = 0;
  let longest = 0;
  // Consecutive scheduled misses running up to (but excluding) today.
  let trailingMisses = 0;

  if (habit.startDate <= today) {
    let d = habit.startDate;
    while (d <= today) {
      if (isScheduled(habit, d)) {
        const mark = marks.get(d);
        if (mark === "done") {
          run += 1;
          if (run > longest) longest = run;
          if (d !== today) trailingMisses = 0;
        } else if (mark === "skipped") {
          // excused: transparent to the run and to the warning
        } else if (d === today) {
          // unfinished today: still in progress, never a miss
        } else {
          run = 0;
          trailingMisses += 1;
        }
      }
      d = addDaysStr(d, 1);
    }
  }

  return {
    current: run,
    longest,
    atRisk: trailingMisses === 1 && marks.get(today) !== "done",
  };
}

/**
 * Completion rate over [today-29, today]: done marks on scheduled days,
 * divided by scheduled days minus skips minus an unmarked today.
 */
export function completionRate30d(
  habit: Habit,
  marks: Map<string, MarkStatus>,
  today: string,
): number {
  const windowStart = addDaysStr(today, -29);
  const start = habit.startDate > windowStart ? habit.startDate : windowStart;
  let done = 0;
  let denom = 0;

  let d = start;
  while (d <= today) {
    if (isScheduled(habit, d)) {
      const mark = marks.get(d);
      denom += 1;
      if (mark === "done") done += 1;
      else if (mark === "skipped") denom -= 1;
      else if (d === today) denom -= 1; // still in progress
    }
    d = addDaysStr(d, 1);
  }

  if (denom <= 0) return 0;
  return Math.round((done / denom) * 100);
}

export function countReps(completions: Completion[]): number {
  return completions.filter((c) => c.status === "done").length;
}
