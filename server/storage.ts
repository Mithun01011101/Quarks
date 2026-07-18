import fs from "fs";
import path from "path";
import type {
  Completion,
  FocusSession,
  Habit,
  InsertCompletion,
  InsertFocusSession,
  InsertHabit,
  InsertStack,
  Stack,
  StackHabit,
  StackWithHabits,
} from "@shared/schema";

export interface IStorage {
  // Habits
  createHabit(habit: InsertHabit): Promise<Habit>;
  getHabit(id: number): Promise<Habit | undefined>;
  getAllHabits(): Promise<Habit[]>; // ordered by sortOrder asc, id asc
  updateHabit(id: number, patch: Partial<InsertHabit>): Promise<Habit | undefined>;
  deleteHabit(id: number): Promise<boolean>; // cascades completions, stack membership, sessions
  reorderHabits(orderedIds: number[]): Promise<void>;

  // Completions (one row per habit-day)
  setCompletion(c: InsertCompletion): Promise<Completion>; // upsert on (habitId, date)
  clearCompletion(habitId: number, date: string): Promise<boolean>;
  getCompletionsForHabit(habitId: number): Promise<Completion[]>;
  getAllCompletions(): Promise<Completion[]>;

  // Stacks
  createStack(stack: InsertStack, habitIds: number[]): Promise<StackWithHabits>;
  getStack(id: number): Promise<Stack | undefined>;
  getAllStacks(): Promise<Stack[]>;
  getStackHabits(stackId: number): Promise<(StackHabit & { habit: Habit })[]>;
  getAllStackHabits(): Promise<StackHabit[]>;
  updateStack(id: number, patch: Partial<InsertStack>): Promise<Stack | undefined>;
  setStackHabits(stackId: number, habitIds: number[]): Promise<void>;
  deleteStack(id: number): Promise<boolean>; // habits survive

  // Focus sessions
  createFocusSession(s: InsertFocusSession): Promise<FocusSession>;
  updateFocusSession(
    id: number,
    patch: {
      secondsFocused?: number;
      completed?: boolean;
      date?: string;
      ended?: boolean;
    },
  ): Promise<FocusSession | undefined>;
  getFocusSessions(habitId?: number): Promise<FocusSession[]>;
}

type StorageData = {
  habits: Habit[];
  completions: Completion[];
  stacks: Stack[];
  stackHabits: StackHabit[];
  focusSessions: FocusSession[];
  nextHabitId: number;
  nextCompletionId: number;
  nextStackId: number;
  nextStackHabitId: number;
  nextFocusSessionId: number;
};

const EMPTY_DATA: StorageData = {
  habits: [],
  completions: [],
  stacks: [],
  stackHabits: [],
  focusSessions: [],
  nextHabitId: 1,
  nextCompletionId: 1,
  nextStackId: 1,
  nextStackHabitId: 1,
  nextFocusSessionId: 1,
};

export class JsonFileStorage implements IStorage {
  private file = path.join(process.cwd(), "quarks.json");
  private data: StorageData | null = null;

  private async load(): Promise<StorageData> {
    if (this.data) return this.data;
    try {
      const raw = await fs.promises.readFile(this.file, "utf-8");
      const parsed = JSON.parse(raw) as StorageData;
      // Revive timestamps (stored as ISO strings in JSON)
      for (const h of parsed.habits) {
        if (h.createdAt) h.createdAt = new Date(h.createdAt);
      }
      for (const c of parsed.completions) {
        if (c.completedAt) c.completedAt = new Date(c.completedAt);
      }
      for (const s of parsed.stacks) {
        if (s.createdAt) s.createdAt = new Date(s.createdAt);
      }
      for (const f of parsed.focusSessions) {
        if (f.startedAt) f.startedAt = new Date(f.startedAt);
        if (f.endedAt) f.endedAt = new Date(f.endedAt);
      }
      this.data = parsed;
    } catch (e: any) {
      if (e?.code === "ENOENT") {
        this.data = structuredClone(EMPTY_DATA);
        await this.save();
      } else {
        throw e;
      }
    }
    return this.data!;
  }

  private async save(): Promise<void> {
    const json = JSON.stringify(this.data, null, 2);
    try {
      await fs.promises.writeFile(this.file, json);
    } catch (e: any) {
      // OneDrive can briefly lock the file mid-sync; retry once.
      if (e?.code === "EBUSY" || e?.code === "EPERM") {
        await new Promise((r) => setTimeout(r, 100));
        await fs.promises.writeFile(this.file, json);
      } else {
        throw e;
      }
    }
  }

  async createHabit(habit: InsertHabit): Promise<Habit> {
    const data = await this.load();
    const row: Habit = {
      id: data.nextHabitId++,
      name: habit.name,
      action: habit.action,
      tinyVersion: habit.tinyVersion ?? null,
      identity: habit.identity,
      time: habit.time ?? null,
      location: habit.location ?? null,
      color: habit.color ?? "ember",
      icon: habit.icon ?? null,
      scheduleDays: habit.scheduleDays ?? "0123456",
      reminderTimes: habit.reminderTimes ?? null,
      pausedOn: habit.pausedOn ?? null,
      startDate: habit.startDate,
      sortOrder: habit.sortOrder ?? 0,
      createdAt: new Date(),
    };
    data.habits.push(row);
    await this.save();
    return row;
  }

  async getHabit(id: number): Promise<Habit | undefined> {
    const data = await this.load();
    return data.habits.find((h) => h.id === id);
  }

  async getAllHabits(): Promise<Habit[]> {
    const data = await this.load();
    return [...data.habits].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }

  async updateHabit(id: number, patch: Partial<InsertHabit>): Promise<Habit | undefined> {
    const data = await this.load();
    const habit = data.habits.find((h) => h.id === id);
    if (!habit) return undefined;
    Object.assign(habit, patch);
    await this.save();
    return habit;
  }

  async deleteHabit(id: number): Promise<boolean> {
    const data = await this.load();
    const before = data.habits.length;
    data.habits = data.habits.filter((h) => h.id !== id);
    if (data.habits.length === before) return false;
    data.completions = data.completions.filter((c) => c.habitId !== id);
    data.stackHabits = data.stackHabits.filter((sh) => sh.habitId !== id);
    data.focusSessions = data.focusSessions.filter((f) => f.habitId !== id);
    await this.save();
    return true;
  }

  async reorderHabits(orderedIds: number[]): Promise<void> {
    const data = await this.load();
    orderedIds.forEach((id, index) => {
      const habit = data.habits.find((h) => h.id === id);
      if (habit) habit.sortOrder = index;
    });
    await this.save();
  }

  async setCompletion(c: InsertCompletion): Promise<Completion> {
    const data = await this.load();
    const existing = data.completions.find(
      (x) => x.habitId === c.habitId && x.date === c.date,
    );
    if (existing) {
      existing.status = c.status ?? "done";
      existing.source = c.source ?? "hold";
      existing.completedAt = new Date();
      await this.save();
      return existing;
    }
    const row: Completion = {
      id: data.nextCompletionId++,
      habitId: c.habitId,
      date: c.date,
      status: c.status ?? "done",
      source: c.source ?? "hold",
      completedAt: new Date(),
    };
    data.completions.push(row);
    await this.save();
    return row;
  }

  async clearCompletion(habitId: number, date: string): Promise<boolean> {
    const data = await this.load();
    const before = data.completions.length;
    data.completions = data.completions.filter(
      (c) => !(c.habitId === habitId && c.date === date),
    );
    if (data.completions.length === before) return false;
    await this.save();
    return true;
  }

  async getCompletionsForHabit(habitId: number): Promise<Completion[]> {
    const data = await this.load();
    return data.completions.filter((c) => c.habitId === habitId);
  }

  async getAllCompletions(): Promise<Completion[]> {
    const data = await this.load();
    return [...data.completions];
  }

  async createStack(stack: InsertStack, habitIds: number[]): Promise<StackWithHabits> {
    const data = await this.load();
    const row: Stack = {
      id: data.nextStackId++,
      name: stack.name,
      anchor: stack.anchor,
      color: stack.color ?? "gold",
      sortOrder: stack.sortOrder ?? 0,
      createdAt: new Date(),
    };
    data.stacks.push(row);
    habitIds.forEach((habitId, i) => {
      data.stackHabits.push({
        id: data.nextStackHabitId++,
        stackId: row.id,
        habitId,
        position: i + 1,
      });
    });
    await this.save();
    return { ...row, habits: await this.getStackHabits(row.id) };
  }

  async getStack(id: number): Promise<Stack | undefined> {
    const data = await this.load();
    return data.stacks.find((s) => s.id === id);
  }

  async getAllStacks(): Promise<Stack[]> {
    const data = await this.load();
    return [...data.stacks].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }

  async getStackHabits(stackId: number): Promise<(StackHabit & { habit: Habit })[]> {
    const data = await this.load();
    const habitById = new Map(data.habits.map((h) => [h.id, h]));
    return data.stackHabits
      .filter((sh) => sh.stackId === stackId)
      .sort((a, b) => a.position - b.position)
      .flatMap((sh) => {
        const habit = habitById.get(sh.habitId);
        return habit ? [{ ...sh, habit }] : [];
      });
  }

  async getAllStackHabits(): Promise<StackHabit[]> {
    const data = await this.load();
    return [...data.stackHabits];
  }

  async updateStack(id: number, patch: Partial<InsertStack>): Promise<Stack | undefined> {
    const data = await this.load();
    const stack = data.stacks.find((s) => s.id === id);
    if (!stack) return undefined;
    Object.assign(stack, patch);
    await this.save();
    return stack;
  }

  async setStackHabits(stackId: number, habitIds: number[]): Promise<void> {
    const data = await this.load();
    data.stackHabits = data.stackHabits.filter((sh) => sh.stackId !== stackId);
    habitIds.forEach((habitId, i) => {
      data.stackHabits.push({
        id: data.nextStackHabitId++,
        stackId,
        habitId,
        position: i + 1,
      });
    });
    await this.save();
  }

  async deleteStack(id: number): Promise<boolean> {
    const data = await this.load();
    const before = data.stacks.length;
    data.stacks = data.stacks.filter((s) => s.id !== id);
    if (data.stacks.length === before) return false;
    data.stackHabits = data.stackHabits.filter((sh) => sh.stackId !== id);
    await this.save();
    return true;
  }

  async createFocusSession(s: InsertFocusSession): Promise<FocusSession> {
    const data = await this.load();
    const row: FocusSession = {
      id: data.nextFocusSessionId++,
      habitId: s.habitId,
      durationMinutes: s.durationMinutes,
      secondsFocused: s.secondsFocused ?? 0,
      completed: s.completed ?? false,
      date: s.date,
      startedAt: new Date(),
      endedAt: null,
    };
    data.focusSessions.push(row);
    await this.save();
    return row;
  }

  async updateFocusSession(
    id: number,
    patch: { secondsFocused?: number; completed?: boolean; date?: string; ended?: boolean },
  ): Promise<FocusSession | undefined> {
    const data = await this.load();
    const session = data.focusSessions.find((f) => f.id === id);
    if (!session) return undefined;
    if (patch.secondsFocused !== undefined) session.secondsFocused = patch.secondsFocused;
    if (patch.completed !== undefined) session.completed = patch.completed;
    if (patch.date !== undefined) session.date = patch.date;
    if (patch.ended) session.endedAt = new Date();
    await this.save();
    return session;
  }

  async getFocusSessions(habitId?: number): Promise<FocusSession[]> {
    const data = await this.load();
    const all = habitId
      ? data.focusSessions.filter((f) => f.habitId === habitId)
      : data.focusSessions;
    return [...all].sort((a, b) => b.id - a.id);
  }
}

// PgStorage lives in pg-storage.ts; the app picks the backend on boot.
import { PgStorage } from "./pg-storage";

export const storage: IStorage = process.env.DATABASE_URL
  ? new PgStorage()
  : new JsonFileStorage();
