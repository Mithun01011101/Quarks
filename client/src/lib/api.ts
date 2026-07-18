import { apiRequest } from "./queryClient";
import type {
  FocusSession,
  Habit,
  HabitDetail,
  InsertHabit,
  ProgressOverview,
  Stack,
  StackWithHabits,
  StreakInfo,
  TodayStack,
  TodayView,
} from "@shared/schema";

export type CompleteResult = {
  completion: { id: number };
  streak: StreakInfo;
  milestone: number | null;
};

export const api = {
  // Habits
  createHabit: async (habit: InsertHabit): Promise<Habit> =>
    (await apiRequest("POST", "/api/habits", habit)).json(),
  updateHabit: async (id: number, patch: Partial<InsertHabit>): Promise<Habit> =>
    (await apiRequest("PATCH", `/api/habits/${id}`, patch)).json(),
  deleteHabit: async (id: number): Promise<void> => {
    await apiRequest("DELETE", `/api/habits/${id}`);
  },
  reorderHabits: async (orderedIds: number[]): Promise<void> => {
    await apiRequest("PUT", "/api/habits/reorder", { orderedIds });
  },

  // Completions
  complete: async (
    habitId: number,
    body: { date: string; source?: "hold" | "focus" | "backfill"; today?: string },
  ): Promise<CompleteResult> =>
    (await apiRequest("POST", `/api/habits/${habitId}/complete`, body)).json(),
  skip: async (habitId: number, date: string): Promise<{ streak: StreakInfo }> =>
    (await apiRequest("POST", `/api/habits/${habitId}/skip`, { date })).json(),
  undoCompletion: async (
    habitId: number,
    date: string,
    today: string,
  ): Promise<{ streak: StreakInfo }> =>
    (
      await apiRequest(
        "DELETE",
        `/api/habits/${habitId}/completions/${date}?today=${today}`,
      )
    ).json(),

  // Pause / resume
  pauseHabit: async (id: number, date: string): Promise<Habit> =>
    (await apiRequest("POST", `/api/habits/${id}/pause`, { date })).json(),
  resumeHabit: async (id: number, date: string): Promise<Habit> =>
    (await apiRequest("POST", `/api/habits/${id}/resume`, { date })).json(),

  // Stacks
  createStack: async (
    stack: { name: string; anchor: string; color?: string },
    habitIds: number[],
  ): Promise<StackWithHabits> =>
    (await apiRequest("POST", "/api/stacks", { stack, habitIds })).json(),
  updateStack: async (
    id: number,
    patch: Partial<{ name: string; anchor: string; color: string }>,
  ): Promise<Stack> => (await apiRequest("PATCH", `/api/stacks/${id}`, patch)).json(),
  setStackHabits: async (id: number, habitIds: number[]): Promise<StackWithHabits> =>
    (await apiRequest("PUT", `/api/stacks/${id}/habits`, { habitIds })).json(),
  deleteStack: async (id: number): Promise<void> => {
    await apiRequest("DELETE", `/api/stacks/${id}`);
  },

  // Focus sessions
  createFocusSession: async (body: {
    habitId: number;
    durationMinutes: number;
    date: string;
  }): Promise<FocusSession> =>
    (await apiRequest("POST", "/api/focus-sessions", body)).json(),
  updateFocusSession: async (
    id: number,
    patch: {
      secondsFocused?: number;
      completed?: boolean;
      date?: string;
      ended?: boolean;
    },
  ): Promise<FocusSession> =>
    (await apiRequest("PATCH", `/api/focus-sessions/${id}`, patch)).json(),
};

// Query-key builders (queryKey[0] doubles as the fetch URL)
export const queryKeys = {
  today: (date: string) => [`/api/today?date=${date}`] as const,
  habits: () => ["/api/habits"] as const,
  habitDetail: (id: number, month: string, today: string) =>
    [`/api/habits/${id}/detail?month=${month}&today=${today}`] as const,
  stacks: (date: string) => [`/api/stacks?date=${date}`] as const,
  progress: (today: string) => [`/api/progress?today=${today}`] as const,
  focusSessions: (habitId?: number) =>
    [habitId ? `/api/focus-sessions?habitId=${habitId}` : "/api/focus-sessions"] as const,
};

export type { TodayView, TodayStack, HabitDetail, ProgressOverview };
