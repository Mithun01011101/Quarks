import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import {
  insertHabitSchema,
  insertStackSchema,
  type Completion,
  type DayState,
  type Habit,
  type HabitDetail,
  type ProgressOverview,
  type TodayHabit,
  type TodayStack,
  type TodayView,
} from "@shared/schema";
import { storage } from "./storage";
import {
  MILESTONES,
  addDaysStr,
  completionRate30d,
  computeStreak,
  countReps,
  isScheduled,
  marksFor,
  weekdayOf,
} from "./streaks";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const dateStr = z.string().regex(DATE_RE, "expected YYYY-MM-DD");

const completeBody = z.object({
  date: dateStr,
  source: z.enum(["hold", "focus", "backfill"]).default("hold"),
  today: dateStr.optional(),
});
const skipBody = z.object({ date: dateStr });
const pauseBody = z.object({ date: dateStr });
const reorderBody = z.object({ orderedIds: z.array(z.number().int()).min(1) });
const createStackBody = z.object({
  stack: insertStackSchema.omit({ sortOrder: true }),
  habitIds: z.array(z.number().int()).min(1),
});
const stackHabitsBody = z.object({ habitIds: z.array(z.number().int()).min(1) });
const createFocusBody = z.object({
  habitId: z.number().int(),
  durationMinutes: z.number().int().min(1).max(180),
  date: dateStr,
});
const patchFocusBody = z.object({
  secondsFocused: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
  date: dateStr.optional(),
  ended: z.boolean().optional(),
});

function fail(res: Response, status: number, message: string) {
  return res.status(status).json({ message });
}

function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof z.ZodError) {
        const issue = e.issues[0];
        return fail(res, 400, `${issue.path.join(".") || "body"}: ${issue.message}`);
      }
      console.error(e);
      return fail(res, 500, e instanceof Error ? e.message : "Internal Server Error");
    }
  };
}

function requireDateParam(req: Request, name: string): string {
  const value = req.query[name];
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [name],
        message: "expected YYYY-MM-DD query param",
      },
    ]);
  }
  return value;
}

function toTodayHabit(
  habit: Habit,
  completionsByHabit: Map<number, Completion[]>,
  date: string,
): TodayHabit {
  const rows = completionsByHabit.get(habit.id) ?? [];
  const marks = marksFor(rows);
  const status = marks.get(date) ?? null;
  return {
    ...habit,
    scheduledToday: isScheduled(habit, date),
    status,
    streak: computeStreak(habit, marks, date),
    totalReps: countReps(rows),
  };
}

async function loadCompletionsByHabit(): Promise<Map<number, Completion[]>> {
  const all = await storage.getAllCompletions();
  const map = new Map<number, Completion[]>();
  for (const c of all) {
    const list = map.get(c.habitId);
    if (list) list.push(c);
    else map.set(c.habitId, [c]);
  }
  return map;
}

async function buildStacksView(
  date: string,
  completionsByHabit: Map<number, Completion[]>,
): Promise<TodayStack[]> {
  const stacksList = await storage.getAllStacks();
  const result: TodayStack[] = [];
  for (const stack of stacksList) {
    const members = await storage.getStackHabits(stack.id);
    result.push({
      ...stack,
      habits: members.map((m) => ({
        ...m,
        habit: toTodayHabit(m.habit, completionsByHabit, date),
      })),
    });
  }
  return result;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Public health check for Render (and quick local sanity checks).
  app.get("/healthz", (_req, res) => {
    res.status(200).send("ok");
  });

  // ---- Today ----

  app.get(
    "/api/today",
    handle(async (req, res) => {
      const date = requireDateParam(req, "date");
      const completionsByHabit = await loadCompletionsByHabit();
      const allHabits = await storage.getAllHabits();

      // Stacks have no UI (owner preference) — every habit lists directly so
      // none can be hidden by a leftover stack membership.
      const view: TodayView = {
        date,
        habits: allHabits.map((h) => toTodayHabit(h, completionsByHabit, date)),
        stacks: await buildStacksView(date, completionsByHabit),
      };
      res.json(view);
    }),
  );

  // ---- Habits ----

  app.get(
    "/api/habits",
    handle(async (_req, res) => {
      res.json(await storage.getAllHabits());
    }),
  );

  app.post(
    "/api/habits",
    handle(async (req, res) => {
      const body = insertHabitSchema.parse(req.body);
      if (!DATE_RE.test(body.startDate)) return fail(res, 400, "startDate: expected YYYY-MM-DD");
      const existing = await storage.getAllHabits();
      const habit = await storage.createHabit({
        ...body,
        sortOrder: body.sortOrder ?? existing.length,
      });
      res.status(201).json(habit);
    }),
  );

  app.patch(
    "/api/habits/:id",
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const patch = insertHabitSchema.partial().parse(req.body);
      const habit = await storage.updateHabit(id, patch);
      if (!habit) return fail(res, 404, "Habit not found");
      res.json(habit);
    }),
  );

  app.delete(
    "/api/habits/:id",
    handle(async (req, res) => {
      const ok = await storage.deleteHabit(Number(req.params.id));
      if (!ok) return fail(res, 404, "Habit not found");
      res.status(204).end();
    }),
  );

  app.put(
    "/api/habits/reorder",
    handle(async (req, res) => {
      const { orderedIds } = reorderBody.parse(req.body);
      await storage.reorderHabits(orderedIds);
      res.status(204).end();
    }),
  );

  // ---- Completions ----

  app.post(
    "/api/habits/:id/complete",
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const body = completeBody.parse(req.body);
      const habit = await storage.getHabit(id);
      if (!habit) return fail(res, 404, "Habit not found");

      if (body.source === "backfill") {
        if (!body.today) return fail(res, 400, "today: required for backfill");
        if (body.date > body.today || body.date < addDaysStr(body.today, -7)) {
          return fail(res, 400, "Only the last 7 days can be edited");
        }
      }

      const completion = await storage.setCompletion({
        habitId: id,
        date: body.date,
        status: "done",
        source: body.source,
      });
      const marks = marksFor(await storage.getCompletionsForHabit(id));
      const streak = computeStreak(habit, marks, body.today ?? body.date);
      const milestone = MILESTONES.includes(streak.current) ? streak.current : null;
      res.json({ completion, streak, milestone });
    }),
  );

  app.post(
    "/api/habits/:id/skip",
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const body = skipBody.parse(req.body);
      const habit = await storage.getHabit(id);
      if (!habit) return fail(res, 404, "Habit not found");
      const completion = await storage.setCompletion({
        habitId: id,
        date: body.date,
        status: "skipped",
        source: "hold",
      });
      const marks = marksFor(await storage.getCompletionsForHabit(id));
      const streak = computeStreak(habit, marks, body.date);
      res.json({ completion, streak });
    }),
  );

  app.delete(
    "/api/habits/:id/completions/:date",
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const date = req.params.date;
      if (!DATE_RE.test(date)) return fail(res, 400, "date: expected YYYY-MM-DD");
      const today = requireDateParam(req, "today");
      const habit = await storage.getHabit(id);
      if (!habit) return fail(res, 404, "Habit not found");
      if (date > today || date < addDaysStr(today, -7)) {
        return fail(res, 400, "Only the last 7 days can be edited");
      }
      await storage.clearCompletion(id, date);
      const marks = marksFor(await storage.getCompletionsForHabit(id));
      res.json({ streak: computeStreak(habit, marks, today) });
    }),
  );

  // ---- Pause / resume ----

  app.post(
    "/api/habits/:id/pause",
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const body = pauseBody.parse(req.body);
      const habit = await storage.updateHabit(id, { pausedOn: body.date });
      if (!habit) return fail(res, 404, "Habit not found");
      res.json(habit);
    }),
  );

  app.post(
    "/api/habits/:id/resume",
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const body = pauseBody.parse(req.body);
      const habit = await storage.getHabit(id);
      if (!habit) return fail(res, 404, "Habit not found");
      if (!habit.pausedOn) return fail(res, 400, "Habit is not paused");

      // Backfill the pause gap as skipped so streak history stays honest.
      const marks = marksFor(await storage.getCompletionsForHabit(id));
      let d = habit.pausedOn;
      while (d < body.date) {
        const wasScheduled =
          d >= habit.startDate && habit.scheduleDays.includes(String(weekdayOf(d)));
        if (wasScheduled && !marks.has(d)) {
          await storage.setCompletion({
            habitId: id,
            date: d,
            status: "skipped",
            source: "backfill",
          });
        }
        d = addDaysStr(d, 1);
      }
      const updated = await storage.updateHabit(id, { pausedOn: null });
      res.json(updated);
    }),
  );

  // ---- Habit detail (calendar) ----

  app.get(
    "/api/habits/:id/detail",
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const habit = await storage.getHabit(id);
      if (!habit) return fail(res, 404, "Habit not found");
      const today = requireDateParam(req, "today");
      const month = req.query.month;
      if (typeof month !== "string" || !MONTH_RE.test(month)) {
        return fail(res, 400, "month: expected YYYY-MM");
      }

      const rows = await storage.getCompletionsForHabit(id);
      const marks = marksFor(rows);
      const days: { date: string; state: DayState }[] = [];
      let d = `${month}-01`;
      while (d.startsWith(month)) {
        const mark = marks.get(d);
        let state: DayState;
        if (mark === "done") state = "done";
        else if (mark === "skipped") state = "skipped";
        else if (d < habit.startDate) state = "before-start";
        else if (d > today) state = "future";
        else if (!isScheduled(habit, d)) state = "unscheduled";
        else if (d === today) state = "due";
        else state = "missed";
        days.push({ date: d, state });
        d = addDaysStr(d, 1);
      }

      const detail: HabitDetail = {
        habit,
        totalReps: countReps(rows),
        streak: computeStreak(habit, marks, today),
        rate30d: completionRate30d(habit, marks, today),
        month: { month, days },
      };
      res.json(detail);
    }),
  );

  // ---- Stacks ----

  app.get(
    "/api/stacks",
    handle(async (req, res) => {
      const date = requireDateParam(req, "date");
      const completionsByHabit = await loadCompletionsByHabit();
      res.json(await buildStacksView(date, completionsByHabit));
    }),
  );

  app.post(
    "/api/stacks",
    handle(async (req, res) => {
      const body = createStackBody.parse(req.body);
      const allHabits = await storage.getAllHabits();
      const habitIds = new Set(allHabits.map((h) => h.id));
      for (const id of body.habitIds) {
        if (!habitIds.has(id)) return fail(res, 400, `Habit ${id} does not exist`);
      }
      const members = await storage.getAllStackHabits();
      const stacked = new Set(members.map((m) => m.habitId));
      for (const id of body.habitIds) {
        if (stacked.has(id)) return fail(res, 400, `Habit ${id} is already in a stack`);
      }
      const existing = await storage.getAllStacks();
      const stack = await storage.createStack(
        { ...body.stack, sortOrder: existing.length },
        body.habitIds,
      );
      res.status(201).json(stack);
    }),
  );

  app.patch(
    "/api/stacks/:id",
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const patch = insertStackSchema.partial().parse(req.body);
      const stack = await storage.updateStack(id, patch);
      if (!stack) return fail(res, 404, "Stack not found");
      res.json(stack);
    }),
  );

  app.put(
    "/api/stacks/:id/habits",
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const stack = await storage.getStack(id);
      if (!stack) return fail(res, 404, "Stack not found");
      const body = stackHabitsBody.parse(req.body);
      const members = await storage.getAllStackHabits();
      const stackedElsewhere = new Set(
        members.filter((m) => m.stackId !== id).map((m) => m.habitId),
      );
      for (const habitId of body.habitIds) {
        if (stackedElsewhere.has(habitId)) {
          return fail(res, 400, `Habit ${habitId} is already in another stack`);
        }
      }
      await storage.setStackHabits(id, body.habitIds);
      res.json({ ...stack, habits: await storage.getStackHabits(id) });
    }),
  );

  app.delete(
    "/api/stacks/:id",
    handle(async (req, res) => {
      const ok = await storage.deleteStack(Number(req.params.id));
      if (!ok) return fail(res, 404, "Stack not found");
      res.status(204).end();
    }),
  );

  // ---- Focus sessions ----

  app.post(
    "/api/focus-sessions",
    handle(async (req, res) => {
      const body = createFocusBody.parse(req.body);
      const habit = await storage.getHabit(body.habitId);
      if (!habit) return fail(res, 404, "Habit not found");
      const session = await storage.createFocusSession({
        habitId: body.habitId,
        durationMinutes: body.durationMinutes,
        date: body.date,
      });
      res.status(201).json(session);
    }),
  );

  app.patch(
    "/api/focus-sessions/:id",
    handle(async (req, res) => {
      const id = Number(req.params.id);
      const patch = patchFocusBody.parse(req.body);
      const session = await storage.updateFocusSession(id, patch);
      if (!session) return fail(res, 404, "Focus session not found");
      res.json(session);
    }),
  );

  app.get(
    "/api/focus-sessions",
    handle(async (req, res) => {
      const habitId = req.query.habitId ? Number(req.query.habitId) : undefined;
      res.json(await storage.getFocusSessions(habitId));
    }),
  );

  // ---- Progress ----

  app.get(
    "/api/progress",
    handle(async (req, res) => {
      const today = requireDateParam(req, "today");
      const allHabits = await storage.getAllHabits();
      const completionsByHabit = await loadCompletionsByHabit();

      let totalReps = 0;
      let bestStreak = 0;
      const perHabit: ProgressOverview["habits"] = [];
      for (const habit of allHabits) {
        const rows = completionsByHabit.get(habit.id) ?? [];
        const marks = marksFor(rows);
        const streak = computeStreak(habit, marks, today);
        const reps = countReps(rows);
        totalReps += reps;
        if (streak.longest > bestStreak) bestStreak = streak.longest;
        perHabit.push({
          id: habit.id,
          name: habit.name,
          color: habit.color,
          icon: habit.icon,
          streak,
          reps,
          rate30d: completionRate30d(habit, marks, today),
        });
      }

      // Aggregate 30-day rate + daily series for the overview chart.
      const last30: ProgressOverview["last30"] = [];
      let aggDone = 0;
      let aggDenom = 0;
      for (let i = 29; i >= 0; i--) {
        const d = addDaysStr(today, -i);
        let done = 0;
        let scheduled = 0;
        for (const habit of allHabits) {
          const marks = marksFor(completionsByHabit.get(habit.id) ?? []);
          const mark = marks.get(d);
          if (mark === "done") done += 1;
          if (isScheduled(habit, d)) {
            scheduled += 1;
            if (mark === "done") {
              aggDone += 1;
              aggDenom += 1;
            } else if (mark === "skipped") {
              // excused
            } else if (d === today) {
              // in progress
            } else {
              aggDenom += 1;
            }
          }
        }
        last30.push({ date: d, done, scheduled });
      }

      const focusSessionsAll = await storage.getFocusSessions();
      const focusMinutes = Math.round(
        focusSessionsAll.reduce((sum, s) => sum + s.secondsFocused, 0) / 60,
      );

      const overview: ProgressOverview = {
        totalReps,
        activeHabits: allHabits.filter((h) => !h.pausedOn).length,
        bestStreak,
        rate30d: aggDenom > 0 ? Math.round((aggDone / aggDenom) * 100) : 0,
        focusMinutes,
        habits: perHabit,
        last30,
      };
      res.json(overview);
    }),
  );

  // ---- Export ----

  app.get(
    "/api/export",
    handle(async (_req, res) => {
      const [habitsAll, completionsAll, stacksAll, stackHabitsAll, focusAll] =
        await Promise.all([
          storage.getAllHabits(),
          storage.getAllCompletions(),
          storage.getAllStacks(),
          storage.getAllStackHabits(),
          storage.getFocusSessions(),
        ]);
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Disposition", `attachment; filename=quarks-backup-${stamp}.json`);
      res.json({
        exportDate: new Date().toISOString(),
        version: "1.0",
        data: {
          habits: habitsAll,
          completions: completionsAll,
          stacks: stacksAll,
          stackHabits: stackHabitsAll,
          focusSessions: focusAll,
        },
      });
    }),
  );

  const httpServer = createServer(app);
  return httpServer;
}
