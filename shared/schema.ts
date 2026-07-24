import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const habits = pgTable("habits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // short label under the circle ("Read")
  kind: text("kind").notNull().default("build"), // 'build' | 'break' (break = avoid a bad habit)
  action: text("action").notNull(), // "read one page"; for break habits = the title verbatim
  tinyVersion: text("tiny_version"), // 2-minute version; null = action already tiny
  identity: text("identity").notNull(), // "...person that reads every day"
  time: text("time"), // "HH:mm" 24h, or null ("anytime")
  location: text("location"),
  color: text("color").notNull().default("ember"), // key into the q-* palette
  icon: text("icon"), // lucide icon name
  scheduleDays: text("schedule_days").notNull().default("0123456"), // 0=Sun..6=Sat
  reminderTimes: text("reminder_times"), // CSV "07:00,21:30" (max 3), null = none
  pausedOn: text("paused_on"), // local date; null = active
  startDate: text("start_date").notNull(), // client's LOCAL date at creation
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const completions = pgTable(
  "completions",
  {
    id: serial("id").primaryKey(),
    habitId: integer("habit_id").notNull(),
    date: text("date").notNull(), // LOCAL "YYYY-MM-DD" sent by the client
    status: text("status").notNull().default("done"), // 'done' | 'skipped'
    source: text("source").notNull().default("hold"), // 'hold' | 'focus' | 'backfill'
    completedAt: timestamp("completed_at").defaultNow(),
  },
  (t) => [uniqueIndex("completions_habit_date_idx").on(t.habitId, t.date)],
);

export const stacks = pgTable("stacks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  anchor: text("anchor").notNull(), // "After I pour my morning coffee"
  color: text("color").notNull().default("gold"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stackHabits = pgTable("stack_habits", {
  id: serial("id").primaryKey(),
  stackId: integer("stack_id").notNull(),
  habitId: integer("habit_id").notNull(), // a habit belongs to AT MOST one stack
  position: integer("position").notNull(), // 1-based chain order
});

export const focusSessions = pgTable("focus_sessions", {
  id: serial("id").primaryKey(),
  habitId: integer("habit_id").notNull(),
  durationMinutes: integer("duration_minutes").notNull(), // planned
  secondsFocused: integer("seconds_focused").notNull().default(0), // actual
  completed: boolean("completed").notNull().default(false), // ran to zero
  date: text("date").notNull(), // local date it counts toward
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const insertHabitSchema = createInsertSchema(habits)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    kind: z.enum(["build", "break"]).default("build"),
  });
export const insertCompletionSchema = createInsertSchema(completions).omit({
  id: true,
  completedAt: true,
});
export const insertStackSchema = createInsertSchema(stacks).omit({
  id: true,
  createdAt: true,
});
export const insertStackHabitSchema = createInsertSchema(stackHabits).omit({
  id: true,
});
export const insertFocusSessionSchema = createInsertSchema(focusSessions).omit({
  id: true,
  startedAt: true,
  endedAt: true,
});

export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type InsertCompletion = z.infer<typeof insertCompletionSchema>;
export type InsertStack = z.infer<typeof insertStackSchema>;
export type InsertStackHabit = z.infer<typeof insertStackHabitSchema>;
export type InsertFocusSession = z.infer<typeof insertFocusSessionSchema>;

export type Habit = typeof habits.$inferSelect;
export type Completion = typeof completions.$inferSelect;
export type Stack = typeof stacks.$inferSelect;
export type StackHabit = typeof stackHabits.$inferSelect;
export type FocusSession = typeof focusSessions.$inferSelect;

// ---- Composite API types (hand-written, shared by server + client) ----

export type MarkStatus = "done" | "skipped";

export type StreakInfo = {
  current: number;
  longest: number;
  atRisk: boolean; // exactly one scheduled miss outstanding -> "don't miss twice"
};

export type TodayHabit = Habit & {
  scheduledToday: boolean;
  status: MarkStatus | null;
  streak: StreakInfo;
  totalReps: number;
};

export type TodayStack = Stack & {
  habits: (StackHabit & { habit: TodayHabit })[];
};

export type TodayView = {
  date: string;
  habits: TodayHabit[]; // unstacked habits only
  stacks: TodayStack[];
};

export type DayState =
  | "done"
  | "skipped"
  | "missed"
  | "due"
  | "unscheduled"
  | "future"
  | "before-start";

export type HabitDetail = {
  habit: Habit;
  totalReps: number;
  streak: StreakInfo;
  rate30d: number; // 0-100
  month: {
    month: string; // "YYYY-MM"
    days: { date: string; state: DayState }[];
  };
};

export type StackWithHabits = Stack & {
  habits: (StackHabit & { habit: Habit })[];
};

export type ProgressOverview = {
  totalReps: number;
  activeHabits: number;
  bestStreak: number;
  rate30d: number;
  focusMinutes: number;
  habits: {
    id: number;
    name: string;
    color: string;
    icon: string | null;
    streak: StreakInfo;
    reps: number;
    rate30d: number;
  }[];
  last30: { date: string; done: number; scheduled: number }[];
};
