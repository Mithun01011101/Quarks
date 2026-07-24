import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FocusSession as FocusSessionRow, TodayHabit, TodayView } from "@shared/schema";
import { FocusSession } from "@/components/focus-session";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { api, queryKeys } from "@/lib/api";
import { localToday } from "@/lib/dates";
import { quarkColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

const PRESETS = [5, 10, 15, 25, 45];

export default function FocusTab() {
  const today = localToday();
  const { data: view } = useQuery<TodayView>({ queryKey: queryKeys.today(today) });
  const { data: sessions } = useQuery<FocusSessionRow[]>({
    queryKey: queryKeys.focusSessions(),
  });

  const habits = useMemo(() => {
    if (!view) return [];
    const all = [...view.habits, ...view.stacks.flatMap((s) => s.habits.map((m) => m.habit))];
    // Break habits are about NOT doing something — a focus session makes no sense.
    return all.filter((h) => !h.pausedOn && h.kind !== "break");
  }, [view]);

  const [habitId, setHabitId] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(10);
  const [active, setActive] = useState<{
    habit: TodayHabit;
    sessionId: number;
    durationMinutes: number;
  } | null>(null);

  const selected = habits.find((h) => h.id === habitId) ?? null;
  const habitById = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);

  const begin = useMutation({
    mutationFn: async () => {
      const session = await api.createFocusSession({
        habitId: selected!.id,
        durationMinutes: minutes,
        date: today,
      });
      return session;
    },
    onSuccess: (session) => {
      setActive({ habit: selected!, sessionId: session.id, durationMinutes: minutes });
    },
  });

  if (active) {
    return (
      <FocusSession
        habit={active.habit}
        sessionId={active.sessionId}
        durationMinutes={active.durationMinutes}
        onExit={() => setActive(null)}
      />
    );
  }

  if (habits.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <h2 className="font-display text-xl">Nothing to focus on yet</h2>
        <p className="max-w-[240px] text-sm text-muted-foreground">
          Create a habit on the Today tab first — then give it your full
          attention here.
        </p>
      </div>
    );
  }

  const recent = (sessions ?? []).slice(0, 5);

  return (
    <div className="space-y-6 py-2">
      <div className="space-y-2">
        <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Habit
        </p>
        <div className="flex flex-wrap gap-2">
          {habits.map((h) => {
            const color = quarkColor(h.color);
            const activeChip = h.id === habitId;
            return (
              <button
                key={h.id}
                type="button"
                aria-pressed={activeChip}
                onClick={() => setHabitId(h.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                  activeChip
                    ? "border-primary bg-accent text-foreground"
                    : "border-border bg-secondary/40 text-muted-foreground hover:bg-accent",
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", color.bg)} />
                {h.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Minutes
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={minutes === m}
              onClick={() => setMinutes(m)}
              className={cn(
                "h-10 w-14 cursor-pointer rounded-full border text-sm font-medium tabular-nums transition-colors",
                minutes === m
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-accent",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 px-1">
          <Slider
            value={[minutes]}
            min={1}
            max={90}
            step={1}
            onValueChange={([v]) => setMinutes(v)}
            aria-label="Custom minutes"
          />
          <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
            {minutes}m
          </span>
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        disabled={!selected || begin.isPending}
        onClick={() => begin.mutate()}
      >
        {selected ? `Begin ${minutes} minutes on ${selected.name}` : "Pick a habit to begin"}
      </Button>

      {recent.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent sessions
          </p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {recent.map((s, i) => {
              const habit = habitById.get(s.habitId);
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm",
                    i > 0 && "border-t border-border",
                  )}
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      habit ? quarkColor(habit.color).bg : "bg-muted-foreground/40",
                    )}
                  />
                  <p className="min-w-0 flex-1 truncate">
                    {habit?.name ?? "Removed habit"}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {Math.round(s.secondsFocused / 60)}m ·{" "}
                    {s.completed ? "finished" : "ended early"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
