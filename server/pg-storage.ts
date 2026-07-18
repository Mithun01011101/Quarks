import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  completions,
  focusSessions,
  habits,
  stackHabits,
  stacks,
  type Completion,
  type FocusSession,
  type Habit,
  type InsertCompletion,
  type InsertFocusSession,
  type InsertHabit,
  type InsertStack,
  type Stack,
  type StackHabit,
  type StackWithHabits,
} from "@shared/schema";
import { requireDb } from "./db";
import type { IStorage } from "./storage";

export class PgStorage implements IStorage {
  private db = requireDb();

  async createHabit(habit: InsertHabit): Promise<Habit> {
    const [row] = await this.db.insert(habits).values(habit).returning();
    return row;
  }

  async getHabit(id: number): Promise<Habit | undefined> {
    const [row] = await this.db.select().from(habits).where(eq(habits.id, id));
    return row;
  }

  async getAllHabits(): Promise<Habit[]> {
    return this.db
      .select()
      .from(habits)
      .orderBy(asc(habits.sortOrder), asc(habits.id));
  }

  async updateHabit(id: number, patch: Partial<InsertHabit>): Promise<Habit | undefined> {
    const [row] = await this.db
      .update(habits)
      .set(patch)
      .where(eq(habits.id, id))
      .returning();
    return row;
  }

  async deleteHabit(id: number): Promise<boolean> {
    const [row] = await this.db.delete(habits).where(eq(habits.id, id)).returning();
    if (!row) return false;
    await this.db.delete(completions).where(eq(completions.habitId, id));
    await this.db.delete(stackHabits).where(eq(stackHabits.habitId, id));
    await this.db.delete(focusSessions).where(eq(focusSessions.habitId, id));
    return true;
  }

  async reorderHabits(orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.db
        .update(habits)
        .set({ sortOrder: i })
        .where(eq(habits.id, orderedIds[i]));
    }
  }

  async setCompletion(c: InsertCompletion): Promise<Completion> {
    const [row] = await this.db
      .insert(completions)
      .values(c)
      .onConflictDoUpdate({
        target: [completions.habitId, completions.date],
        set: {
          status: c.status ?? "done",
          source: c.source ?? "hold",
          completedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async clearCompletion(habitId: number, date: string): Promise<boolean> {
    const rows = await this.db
      .delete(completions)
      .where(and(eq(completions.habitId, habitId), eq(completions.date, date)))
      .returning();
    return rows.length > 0;
  }

  async getCompletionsForHabit(habitId: number): Promise<Completion[]> {
    return this.db.select().from(completions).where(eq(completions.habitId, habitId));
  }

  async getAllCompletions(): Promise<Completion[]> {
    return this.db.select().from(completions);
  }

  async createStack(stack: InsertStack, habitIds: number[]): Promise<StackWithHabits> {
    const [row] = await this.db.insert(stacks).values(stack).returning();
    if (habitIds.length > 0) {
      await this.db.insert(stackHabits).values(
        habitIds.map((habitId, i) => ({
          stackId: row.id,
          habitId,
          position: i + 1,
        })),
      );
    }
    return { ...row, habits: await this.getStackHabits(row.id) };
  }

  async getStack(id: number): Promise<Stack | undefined> {
    const [row] = await this.db.select().from(stacks).where(eq(stacks.id, id));
    return row;
  }

  async getAllStacks(): Promise<Stack[]> {
    return this.db.select().from(stacks).orderBy(asc(stacks.sortOrder), asc(stacks.id));
  }

  async getStackHabits(stackId: number): Promise<(StackHabit & { habit: Habit })[]> {
    const members = await this.db
      .select()
      .from(stackHabits)
      .where(eq(stackHabits.stackId, stackId))
      .orderBy(asc(stackHabits.position));
    if (members.length === 0) return [];
    const habitRows = await this.db
      .select()
      .from(habits)
      .where(inArray(habits.id, members.map((m) => m.habitId)));
    const habitById = new Map(habitRows.map((h) => [h.id, h]));
    return members.flatMap((m) => {
      const habit = habitById.get(m.habitId);
      return habit ? [{ ...m, habit }] : [];
    });
  }

  async getAllStackHabits(): Promise<StackHabit[]> {
    return this.db.select().from(stackHabits);
  }

  async updateStack(id: number, patch: Partial<InsertStack>): Promise<Stack | undefined> {
    const [row] = await this.db
      .update(stacks)
      .set(patch)
      .where(eq(stacks.id, id))
      .returning();
    return row;
  }

  async setStackHabits(stackId: number, habitIds: number[]): Promise<void> {
    await this.db.delete(stackHabits).where(eq(stackHabits.stackId, stackId));
    if (habitIds.length > 0) {
      await this.db.insert(stackHabits).values(
        habitIds.map((habitId, i) => ({
          stackId,
          habitId,
          position: i + 1,
        })),
      );
    }
  }

  async deleteStack(id: number): Promise<boolean> {
    const [row] = await this.db.delete(stacks).where(eq(stacks.id, id)).returning();
    if (!row) return false;
    await this.db.delete(stackHabits).where(eq(stackHabits.stackId, id));
    return true;
  }

  async createFocusSession(s: InsertFocusSession): Promise<FocusSession> {
    const [row] = await this.db.insert(focusSessions).values(s).returning();
    return row;
  }

  async updateFocusSession(
    id: number,
    patch: { secondsFocused?: number; completed?: boolean; date?: string; ended?: boolean },
  ): Promise<FocusSession | undefined> {
    const set: Record<string, unknown> = {};
    if (patch.secondsFocused !== undefined) set.secondsFocused = patch.secondsFocused;
    if (patch.completed !== undefined) set.completed = patch.completed;
    if (patch.date !== undefined) set.date = patch.date;
    if (patch.ended) set.endedAt = new Date();
    if (Object.keys(set).length === 0) return this.getFocusSession(id);
    const [row] = await this.db
      .update(focusSessions)
      .set(set)
      .where(eq(focusSessions.id, id))
      .returning();
    return row;
  }

  private async getFocusSession(id: number): Promise<FocusSession | undefined> {
    const [row] = await this.db.select().from(focusSessions).where(eq(focusSessions.id, id));
    return row;
  }

  async getFocusSessions(habitId?: number): Promise<FocusSession[]> {
    if (habitId !== undefined) {
      return this.db
        .select()
        .from(focusSessions)
        .where(eq(focusSessions.habitId, habitId))
        .orderBy(desc(focusSessions.id));
    }
    return this.db.select().from(focusSessions).orderBy(desc(focusSessions.id));
  }
}
