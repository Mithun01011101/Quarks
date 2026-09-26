import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Minus, Play, Plus } from "lucide-react";
import type { FocusSession as FocusSessionRow, TodayHabit, TodayView } from "@shared/schema";
import { FocusSession } from "@/components/focus-session";
import { api, queryKeys } from "@/lib/api";
import { localToday } from "@/lib/dates";
import { quarkColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

const PRESETS = [5, 10, 15, 25, 45];
const MIN_MINUTES = 1;
const MAX_MINUTES = 90;

function SectionLabel({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      className="px-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground"
    >
      {children}
    </p>
  );
}

export default function FocusTab() {
  const today = localToday();
  const { data: view } = useQuery<TodayView>({ queryKey: queryKeys.today(today) });
  const { data: sessions } = useQuery<FocusSessionRow[]>({
    queryKey: queryKeys.focusSessions(),
  });

  const habits = useMemo(() => {
    if (!view) return [];
    // Break habits are about NOT doing something — a focus session makes no sense.
    return view.habits.filter((h) => !h.pausedOn && h.kind !== "break");
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
    mutationFn: async () =>
      api.createFocusSession({
        habitId: selected!.id,
        durationMinutes: minutes,
        date: today,
      }),
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

  const header = (
    <header className="space-y-1 px-1">
      <h1 className="font-display text-[30px] font-medium leading-[34px] tracking-[-0.01em]">
        Focus
      </h1>
      <p className="text-sm text-muted-foreground">Give one habit your full attention.</p>
    </header>
  );

  if (view && habits.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <h2 className="font-display text-xl">Nothing to focus on yet</h2>
          <p className="max-w-[240px] text-sm text-muted-foreground">
            Create a habit on the Today tab first — then give it your full attention here.
          </p>
        </div>
      </div>
    );
  }

  const recent = (sessions ?? []).slice(0, 5);
  const stepper =
    "flex h-[52px] w-[52px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-input bg-card transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="space-y-6 pb-24">
      {header}

      <section role="group" aria-labelledby="focus-habit" className="space-y-2.5">
        <SectionLabel id="focus-habit">Habit</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {habits.map((h) => {
            const isPicked = h.id === habitId;
            return (
              <button
                key={h.id}
                type="button"
                aria-pressed={isPicked}
                onClick={() => setHabitId(h.id)}
                className={cn(
                  "flex h-14 min-w-0 cursor-pointer items-center gap-2.5 rounded-full bg-card pl-4 pr-3.5 text-left text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isPicked
                    ? "border-2 border-foreground font-semibold"
                    : "border border-border/80 font-medium hover:bg-accent/40",
                )}
              >
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", quarkColor(h.color).bg)} />
                <span className="min-w-0 flex-1 truncate">{h.name}</span>
                {isPicked && <Check size={18} strokeWidth={2.6} className="shrink-0" aria-hidden />}
              </button>
            );
          })}
        </div>
      </section>

      <section role="group" aria-labelledby="focus-length" className="space-y-2.5">
        <SectionLabel id="focus-length">How long</SectionLabel>
        <div className="flex h-16 items-center gap-3">
          <button
            type="button"
            aria-label="One minute less"
            disabled={minutes <= MIN_MINUTES}
            onClick={() => setMinutes((m) => Math.max(MIN_MINUTES, m - 1))}
            className={stepper}
          >
            <Minus size={20} strokeWidth={2.4} />
          </button>
          <p aria-live="polite" className="flex flex-1 items-baseline justify-center gap-1.5">
            <span className="font-display text-5xl font-medium leading-[52px]">{minutes}</span>
            <span className="text-[15px] text-muted-foreground">
              {minutes === 1 ? "minute" : "minutes"}
            </span>
          </p>
          <button
            type="button"
            aria-label="One minute more"
            disabled={minutes >= MAX_MINUTES}
            onClick={() => setMinutes((m) => Math.min(MAX_MINUTES, m + 1))}
            className={stepper}
          >
            <Plus size={20} strokeWidth={2.4} />
          </button>
        </div>
        <div className="flex gap-2">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={minutes === m}
              aria-label={`${m} minutes`}
              onClick={() => setMinutes(m)}
              className={cn(
                "h-11 min-w-0 flex-1 cursor-pointer rounded-full border text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                minutes === m
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : "border-input font-medium hover:bg-accent/60",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="focus-recent" className="space-y-2.5">
          <SectionLabel id="focus-recent">Recent sessions</SectionLabel>
          <div className="divide-y divide-border/80 overflow-hidden rounded-3xl border border-border/80 bg-card">
            {recent.map((s) => {
              const habit = habitById.get(s.habitId);
              return (
                <div key={s.id} className="flex min-h-[52px] items-center gap-3 px-4 py-3 text-sm">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      habit ? quarkColor(habit.color).bg : "bg-muted-foreground/40",
                    )}
                  />
                  <p className="min-w-0 flex-1 truncate">{habit?.name ?? "Removed habit"}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {Math.round(s.secondsFocused / 60)}m · {s.completed ? "finished" : "ended early"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Begin sits just above the tab bar, where the thumb already is. Portaled
          so the tab slide-in transform can't re-anchor its fixed position. */}
      {createPortal(
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-b from-background/0 via-background/90 to-background"
            style={{ height: "calc(max(env(safe-area-inset-bottom), 12px) + 176px)" }}
          />
          <div
            className="fixed inset-x-0 z-40 mx-auto w-full max-w-lg px-4"
            style={{ bottom: "calc(max(env(safe-area-inset-bottom), 12px) + 80px)" }}
          >
            <button
              type="button"
              disabled={!selected || begin.isPending}
              onClick={() => begin.mutate()}
              className="flex h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground shadow-[0_8px_20px_rgba(28,27,23,0.18)] transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none"
            >
              {selected ? (
                <>
                  <Play size={16} fill="currentColor" aria-hidden />
                  <span className="truncate">
                    Begin {minutes} {minutes === 1 ? "minute" : "minutes"} · {selected.name}
                  </span>
                </>
              ) : (
                "Pick a habit to begin"
              )}
            </button>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
