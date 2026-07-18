import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import type { Habit, TodayHabit, TodayView } from "@shared/schema";
import { HabitCard } from "@/components/habit-card";
import { HabitSheet } from "@/components/habit-sheet";
import { HabitWizard } from "@/components/habit-wizard/habit-wizard";
import { MilestoneOverlay } from "@/components/milestone-overlay";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import SettingsTab from "@/pages/settings-tab";
import { api, queryKeys } from "@/lib/api";
import { localToday } from "@/lib/dates";
import { cn } from "@/lib/utils";

function patchHabit(
  view: TodayView | undefined,
  habitId: number,
  fn: (h: TodayHabit) => TodayHabit,
): TodayView | undefined {
  if (!view) return view;
  return {
    ...view,
    habits: view.habits.map((h) => (h.id === habitId ? fn(h) : h)),
    stacks: view.stacks.map((s) => ({
      ...s,
      habits: s.habits.map((m) =>
        m.habit.id === habitId ? { ...m, habit: fn(m.habit) } : m,
      ),
    })),
  };
}

function parseLocal(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shiftDays(date: string, by: number): string {
  const d = parseLocal(date);
  d.setDate(d.getDate() + by);
  return format(d, "yyyy-MM-dd");
}

function readCompact(): boolean {
  try {
    return localStorage.getItem("quarks-compact") === "on";
  } catch {
    return false;
  }
}

export default function TodayTab() {
  const realToday = localToday();
  const [viewDate, setViewDate] = useState(realToday);
  const keyView = queryKeys.today(viewDate);
  const queryClient = useQueryClient();

  const [compact, setCompact] = useState(readCompact);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Habit | null>(null);
  const [sheetHabitId, setSheetHabitId] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<{ value: number; color: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: view, isLoading, error } = useQuery<TodayView>({ queryKey: keyView });

  const setCompactPersist = (v: boolean) => {
    setCompact(v);
    try {
      localStorage.setItem("quarks-compact", v ? "on" : "off");
    } catch {
      // best-effort
    }
  };

  const toggle = useMutation({
    mutationFn: (habit: TodayHabit) =>
      habit.status === "done"
        ? api.undoCompletion(habit.id, viewDate, realToday)
        : api.complete(habit.id, {
            date: viewDate,
            source: viewDate === realToday ? "hold" : "backfill",
            today: realToday,
          }),
    onMutate: async (habit) => {
      await queryClient.cancelQueries({ queryKey: keyView });
      const prev = queryClient.getQueryData<TodayView>(keyView);
      queryClient.setQueryData<TodayView>(keyView, (old) =>
        patchHabit(old, habit.id, (h) => {
          const undoing = h.status === "done";
          return {
            ...h,
            status: undoing ? null : "done",
            totalReps: Math.max(0, h.totalReps + (undoing ? -1 : 1)),
            streak: {
              ...h.streak,
              current: Math.max(0, h.streak.current + (undoing ? -1 : 1)),
              atRisk: false,
            },
          };
        }),
      );
      return { prev };
    },
    onError: (_err, _habit, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(keyView, ctx.prev);
      setFlash("Couldn't save that — check the connection and try again.");
      window.setTimeout(() => setFlash(null), 4000);
    },
    onSuccess: (result, habit) => {
      // Milestone truth is server-side; escalate only on its say-so.
      const value = (result as { milestone?: number | null }).milestone ?? null;
      if (value) setMilestone({ value, color: habit.color });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keyView });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress(realToday) });
      if (viewDate !== realToday) {
        queryClient.invalidateQueries({ queryKey: queryKeys.today(realToday) });
      }
    },
  });

  const resume = useMutation({
    mutationFn: (habit: TodayHabit) => api.resumeHabit(habit.id, realToday),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keyView });
      queryClient.invalidateQueries({ queryKey: queryKeys.progress(realToday) });
    },
  });

  const allHabits = useMemo(() => {
    if (!view) return [];
    return [...view.habits, ...view.stacks.flatMap((s) => s.habits.map((m) => m.habit))];
  }, [view]);

  const scheduled = view?.habits.filter((h) => h.scheduledToday && !h.pausedOn) ?? [];
  const unscheduled = view?.habits.filter((h) => !h.scheduledToday && !h.pausedOn) ?? [];
  const paused = view?.habits.filter((h) => h.pausedOn) ?? [];
  const dueCount = scheduled.length;
  const doneCount = scheduled.filter((h) => h.status === "done").length;
  const sheetHabit = allHabits.find((h) => h.id === sheetHabitId) ?? null;
  const empty = allHabits.length === 0;

  const strip = useMemo(
    () => [-4, -3, -2, -1, 0].map((off) => shiftDays(realToday, off)),
    [realToday],
  );

  return (
    <div className="space-y-6 pb-2">
      {/* ---- Today header: mark, Habits pill, date strip, compact toggle ---- */}
      <div className="relative pt-5">
        <div
          className="dot-grid pointer-events-none absolute -inset-x-4 -top-2 h-36 text-foreground/[0.06]"
          aria-hidden
        />
        <div className="relative flex items-center justify-between px-1">
          <button
            type="button"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center gap-[3px] rounded-full border border-border/70 bg-card transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="h-[7px] w-[7px] rounded-full bg-q-ember" />
            <span className="h-[7px] w-[7px] rounded-full bg-q-gold" />
            <span className="h-[7px] w-[7px] rounded-full bg-q-sage" />
          </button>
          <Button
            size="sm"
            className="h-10 px-4"
            onClick={() => {
              setEditTarget(null);
              setWizardOpen(true);
            }}
          >
            <Plus size={16} /> Habits
          </Button>
        </div>

        <div className="relative flex items-end justify-between px-2 pt-6">
          {strip.map((date) => {
            const isToday = date === realToday;
            const active = date === viewDate;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setViewDate(date)}
                aria-current={active ? "date" : undefined}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-0.5 border-b-2 px-2 pb-1.5 transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground",
                )}
              >
                <span className="text-xs font-medium">
                  {isToday ? "Today" : format(parseLocal(date), "EEE")}
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {format(parseLocal(date), "dd")}
                </span>
              </button>
            );
          })}
        </div>

        {!empty && (
          <div className="flex items-center justify-end gap-2.5 px-1 pt-4">
            <span className="text-sm text-muted-foreground">Compact View</span>
            <Switch
              checked={compact}
              onCheckedChange={setCompactPersist}
              aria-label="Compact view"
            />
          </div>
        )}
      </div>

      {flash && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {flash}
        </p>
      )}

      {isLoading ? (
        <p className="px-1 py-8 text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="px-1 py-8 text-sm text-destructive">
          Couldn't load the day: {(error as Error).message}
        </p>
      ) : empty ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex items-center gap-2" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-q-ember/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-q-gold/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-q-sage/70" />
          </div>
          <h2 className="font-display text-2xl">Start with one tiny habit</h2>
          <p className="max-w-[250px] text-sm text-muted-foreground">
            Something you can do in two minutes. Tap “Habits” to build it.
          </p>
        </div>
      ) : (
        <>
          <div className="px-1">
            {dueCount > 0 && doneCount === dueCount ? (
              <p className="font-display text-base italic text-q-sage">
                All done{viewDate === realToday ? " for today" : ""}. Every rep counts.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">
                  {doneCount} of {dueCount}
                </span>{" "}
                done{" "}
                {viewDate === realToday
                  ? "today"
                  : `on ${format(parseLocal(viewDate), "EEE dd")}`}
              </p>
            )}
          </div>

          {scheduled.length > 0 && (
            <div className={cn(compact ? "space-y-2" : "space-y-4")}>
              {scheduled.map((h) => (
                <HabitCard
                  key={h.id}
                  habit={h}
                  compact={compact}
                  onToggle={(x) => toggle.mutate(x)}
                  onTap={(x) => setSheetHabitId(x.id)}
                />
              ))}
            </div>
          )}

          {unscheduled.length > 0 && (
            <div className="space-y-2">
              <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Not scheduled this day
              </p>
              <div className="space-y-2">
                {unscheduled.map((h) => (
                  <HabitCard
                    key={h.id}
                    habit={h}
                    compact
                    onToggle={(x) => toggle.mutate(x)}
                    onTap={(x) => setSheetHabitId(x.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {paused.length > 0 && viewDate === realToday && (
            <div className="space-y-2">
              <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Paused
              </p>
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                {paused.map((h, i) => (
                  <div
                    key={h.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      i > 0 && "border-t border-border/70",
                    )}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                    <p className="min-w-0 flex-1 truncate font-display text-sm text-muted-foreground">
                      {h.name}
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={resume.isPending}
                      onClick={() => resume.mutate(h)}
                    >
                      Resume
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </>
      )}

      <MilestoneOverlay
        milestone={milestone?.value ?? null}
        colorKey={milestone?.color ?? "ember"}
        onDone={() => setMilestone(null)}
      />
      <HabitWizard open={wizardOpen} onOpenChange={setWizardOpen} editHabit={editTarget} />
      <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DrawerContent className="h-[94dvh]">
          <DrawerHeader className="pb-0 text-left">
            <DrawerTitle className="font-sans text-lg font-bold tracking-tight">
              Settings
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-8">
            <SettingsTab />
          </div>
        </DrawerContent>
      </Drawer>
      <HabitSheet
        habit={sheetHabit}
        date={viewDate}
        realToday={realToday}
        open={sheetHabit !== null}
        onOpenChange={(open) => {
          if (!open) setSheetHabitId(null);
        }}
        onEdit={(h) => {
          setEditTarget(h);
          setWizardOpen(true);
        }}
      />
    </div>
  );
}
