/**
 * Sanity checks for the "don't miss twice" streak engine.
 * Run: npx tsx scripts/check-streaks.ts   (exits 1 on any failure)
 */
import type { Habit, MarkStatus } from "../shared/schema";
import { addDaysStr, completionRate30d, computeStreak } from "../server/streaks";

let failures = 0;

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 1,
    name: "Read",
    kind: "build",
    action: "read one page",
    tinyVersion: null,
    identity: "reads every day",
    time: null,
    location: null,
    color: "ember",
    icon: null,
    scheduleDays: "0123456",
    reminderTimes: null,
    pausedOn: null,
    startDate: "2026-07-01",
    sortOrder: 0,
    createdAt: null,
    ...overrides,
  };
}

function marks(entries: Record<string, MarkStatus>): Map<string, MarkStatus> {
  return new Map(Object.entries(entries));
}

function expect(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}\n      expected ${e}\n      got      ${a}`);
  }
}

// 1. Simple run: done Jul 1-5, today Jul 5 -> current 5
{
  const m = marks({
    "2026-07-01": "done",
    "2026-07-02": "done",
    "2026-07-03": "done",
    "2026-07-04": "done",
    "2026-07-05": "done",
  });
  const s = computeStreak(habit(), m, "2026-07-05");
  expect("5-day run", [s.current, s.longest, s.atRisk], [5, 5, false]);
}

// 2. One miss is forgiven with a warning: done 1-5, miss 6, today 7 unmarked
{
  const m = marks({
    "2026-07-01": "done",
    "2026-07-02": "done",
    "2026-07-03": "done",
    "2026-07-04": "done",
    "2026-07-05": "done",
  });
  const s = computeStreak(habit(), m, "2026-07-07");
  expect("miss once -> atRisk, streak kept", [s.current, s.atRisk], [5, true]);
}

// 3. Completing today after a single miss forgives it (5 -> 6, warning gone)
{
  const m = marks({
    "2026-07-01": "done",
    "2026-07-02": "done",
    "2026-07-03": "done",
    "2026-07-04": "done",
    "2026-07-05": "done",
    "2026-07-07": "done",
  });
  const s = computeStreak(habit(), m, "2026-07-07");
  expect("done after one miss -> forgiven", [s.current, s.atRisk], [6, false]);
}

// 4. Two consecutive misses break the streak
{
  const m = marks({
    "2026-07-01": "done",
    "2026-07-02": "done",
    "2026-07-03": "done",
    "2026-07-04": "done",
    "2026-07-05": "done",
  });
  const s = computeStreak(habit(), m, "2026-07-08");
  expect("missed twice -> broken", [s.current, s.longest, s.atRisk], [0, 5, false]);
}

// 5. Unfinished today never breaks or warns on a healthy streak
{
  const m = marks({ "2026-07-01": "done", "2026-07-02": "done" });
  const s = computeStreak(habit(), m, "2026-07-03");
  expect("unfinished today is neutral", [s.current, s.atRisk], [2, false]);
}

// 6. Mon/Wed/Fri schedule: missing Wed and Fri breaks despite Thu between
//    (2026-07-06 is a Monday)
{
  const mwf = habit({ scheduleDays: "135", startDate: "2026-07-06" });
  const m = marks({ "2026-07-06": "done" }); // Mon done; Wed 8th + Fri 10th missed
  const s = computeStreak(mwf, m, "2026-07-11");
  expect("scheduled-day adjacency break", [s.current, s.longest], [0, 1]);
}

// 7. Mon/Wed/Fri: one scheduled miss only -> still alive + warning
{
  const mwf = habit({ scheduleDays: "135", startDate: "2026-07-06" });
  const m = marks({ "2026-07-06": "done" }); // Wed 8th missed, Thu 9th = today
  const s = computeStreak(mwf, m, "2026-07-09");
  expect("scheduled miss once -> warning", [s.current, s.atRisk], [1, true]);
}

// 8. Skips are excused but transparent: done, miss, skip, miss -> broken
{
  const m = marks({
    "2026-07-01": "done",
    "2026-07-03": "skipped",
  });
  // Jul 2 missed, Jul 3 skipped, Jul 4 missed -> two misses across the skip
  const s = computeStreak(habit(), m, "2026-07-05");
  expect("skip cannot shield a lapse", [s.current], [0]);
}

// 9. Skip alone does not warn or break: done, skip, today
{
  const m = marks({
    "2026-07-01": "done",
    "2026-07-02": "skipped",
  });
  const s = computeStreak(habit(), m, "2026-07-03");
  expect("skip is excused", [s.current, s.atRisk], [1, false]);
}

// 10. Milestone boundary: 7 done days -> current 7
{
  const entries: Record<string, MarkStatus> = {};
  for (let i = 0; i < 7; i++) entries[addDaysStr("2026-07-01", i)] = "done";
  const s = computeStreak(habit(), marks(entries), "2026-07-07");
  expect("7-day milestone value", [s.current], [7]);
}

// 11. Paused habit: days on/after pausedOn are unscheduled (streak frozen)
{
  const paused = habit({ pausedOn: "2026-07-04" });
  const m = marks({
    "2026-07-01": "done",
    "2026-07-02": "done",
    "2026-07-03": "done",
  });
  const s = computeStreak(paused, m, "2026-07-10");
  expect("pause freezes the streak", [s.current, s.atRisk], [3, false]);
}

// 12. Rate: 10 scheduled days, 8 done, 1 skipped, 1 missed -> 8/9 = 89
{
  const entries: Record<string, MarkStatus> = {};
  for (let i = 0; i < 8; i++) entries[addDaysStr("2026-07-01", i)] = "done";
  entries["2026-07-09"] = "skipped";
  // Jul 10 missed, today Jul 11 done -> window has 11 days; skipped excused
  entries["2026-07-11"] = "done";
  const rate = completionRate30d(habit(), marks(entries), "2026-07-11");
  expect("rate30d math", [rate], [90]); // 9 done / 10 counted (11 - 1 skipped)
}

console.log("");
if (failures > 0) {
  console.error(`${failures} check(s) FAILED`);
  process.exit(1);
} else {
  console.log("All streak checks passed.");
}
