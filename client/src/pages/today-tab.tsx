import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, X } from "lucide-react";
import type { Habit, ProgressOverview, TodayHabit, TodayView } from "@shared/schema";
import { HabitCard, type Celebration } from "@/components/habit-card";
import { HabitRow } from "@/components/habit-row";
import { HabitSheet } from "@/components/habit-sheet";
import { DayStrip, type StripDay } from "@/components/day-strip";
import { HabitWizard } from "@/components/habit-wizard/habit-wizard";
import { MilestoneOverlay } from "@/components/milestone-overlay";
import { burstSeedFor } from "@/components/burst-celebration";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import SettingsTab from "@/pages/settings-tab";
import { HabitDetailPage } from "@/pages/habit-detail";
import { useTabReselect } from "@/hooks/use-tab-reselect";
import { api, queryKeys } from "@/lib/api";
import { initAudio, playComplete } from "@/lib/audio";
import { vibrate } from "@/lib/settings";
import { dayTitle, localToday, shiftDays, shortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

// A completed card stays put long enough for its pop + burst, then slides
// down into the Done list.
const LINGER_MS = 1100;
// "Mark done" in the sheet waits for the sheet to slide away before the burst.
const SHEET_CLOSE_MS = 320;

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

const COMPACT_KEY = "quarks-compact";

function readCompact(): boolean {
  try {
    return localStorage.getItem(COMPACT_KEY) === "on";
  } catch {
    return false;
  }
}

const itemMotion = {
  layout: true,
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.94, transition: { duration: 0.18 } },
  transition: { type: "spring", bounce: 0.15, duration: 0.45 },
} as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </p>
  );
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
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<{ value: number; color: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lingering, setLingering] = useState<Set<number>>(() => new Set());
  const [celebrations, setCelebrations] = useState<Record<number, Celebration>>({});
  const timers = useRef<number[]>([]);
  const scrollBack = useRef(0);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Tapping the Today tab again comes back here: today, top of the list.
  useTabReselect("today", () => {
    setHistoryId(null);
    setViewDate(localToday());
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const linger = useCallback(
    (id: number, ms: number) => {
      setLingering((s) => new Set(s).add(id));
      later(
        () =>
          setLingering((s) => {
            const next = new Set(s);
            next.delete(id);
            return next;
          }),
        ms,
      );
    },
    [later],
  );

  const { data: view, isLoading, error } = useQuery<TodayView>({ queryKey: keyView });
  const { data: progress } = useQuery<ProgressOverview>({
    queryKey: queryKeys.progress(realToday),
  });

  const setCompactPersist = (v: boolean) => {
    setCompact(v);
    try {
      localStorage.setItem(COMPACT_KEY, v ? "on" : "off");
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
          const last = h.recent.length - 1;
          return {
            ...h,
            status: undoing ? null : "done",
            totalReps: Math.max(0, h.totalReps + (undoing ? -1 : 1)),
            streak: {
              ...h.streak,
              // Only scheduled days count toward a streak (server/streaks.ts);
              // a bonus rep on an off-day leaves it as it is.
              current: h.scheduledToday
                ? Math.max(0, h.streak.current + (undoing ? -1 : 1))
                : h.streak.current,
              atRisk: false,
            },
            recent: h.recent.map((r, i) =>
              i === last
                ? { ...r, state: undoing ? (h.scheduledToday ? "due" : "unscheduled") : "done" }
                : r,
            ),
          };
        }),
      );
      return { prev };
    },
    onError: (_err, _habit, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(keyView, ctx.prev);
      setFlash("Couldn't save that — check the connection and try again.");
      later(() => setFlash(null), 4000);
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

  // Held on a card or row: the card celebrates itself; keep it in place a beat.
  const onHoldToggle = (habit: TodayHabit) => {
    if (habit.status !== "done") linger(habit.id, LINGER_MS);
    toggle.mutate(habit);
  };

  // "Mark done" in the sheet: same completion, celebrated on the card once the
  // sheet is out of the way. Audio is unlocked now, inside the tap.
  const markDoneFromSheet = (habit: TodayHabit) => {
    initAudio();
    setSheetHabitId(null);
    linger(habit.id, SHEET_CLOSE_MS + LINGER_MS);
    later(() => {
      playComplete();
      vibrate(35);
      setCelebrations((c) => ({
        ...c,
        [habit.id]: { seed: burstSeedFor(habit.id), at: Date.now() },
      }));
    }, SHEET_CLOSE_MS);
    // Consumed on the spot; drop it so nothing can replay it later.
    later(
      () =>
        setCelebrations((c) => {
          const next = { ...c };
          delete next[habit.id];
          return next;
        }),
      SHEET_CLOSE_MS + 600,
    );
    toggle.mutate(habit);
  };

  const openHistory = (habit: TodayHabit) => {
    scrollBack.current = window.scrollY;
    setSheetHabitId(null);
    setHistoryId(habit.id);
    window.scrollTo(0, 0);
  };

  const closeHistory = () => {
    setHistoryId(null);
    const y = scrollBack.current;
    requestAnimationFrame(() => window.scrollTo(0, y));
  };

  const habits = useMemo(() => view?.habits ?? [], [view]);
  const active = habits.filter((h) => !h.pausedOn);
  const scheduled = active.filter((h) => h.scheduledToday);
  const toDo = scheduled.filter((h) => h.status === null || lingering.has(h.id));
  const doneList = scheduled.filter((h) => h.status === "done" && !lingering.has(h.id));
  const skippedList = scheduled.filter((h) => h.status === "skipped");
  const offDay = active.filter((h) => !h.scheduledToday);
  const paused = habits.filter((h) => h.pausedOn);
  const due = scheduled.length - skippedList.length;
  const doneCount = scheduled.filter((h) => h.status === "done").length;
  const sheetHabit = habits.find((h) => h.id === sheetHabitId) ?? null;
  const empty = !isLoading && !error && habits.length === 0;
  const isToday = viewDate === realToday;

  const countText =
    scheduled.length === 0
      ? "Nothing scheduled"
      : due === 0
        ? "All skipped"
        : doneCount >= due
          ? `All ${due} done`
          : `${doneCount} of ${due} done`;

  // The strip always shows the 7 days ending today, whatever day is open.
  const strip: StripDay[] = useMemo(() => {
    const byDate = new Map((progress?.last30 ?? []).map((d) => [d.date, d]));
    return [-6, -5, -4, -3, -2, -1, 0].map((off) => {
      const date = shiftDays(realToday, off);
      const d = byDate.get(date);
      return {
        date,
        done: d?.scheduledDone ?? 0,
        due: d ? d.scheduled - d.scheduledSkipped : 0,
      };
    });
  }, [progress, realToday]);

  // Only rows that stay put through a completion get the sheet's celebration
  // (to-do cards and off-day rows); a Done row is born after it's over.
  const rowProps = (h: TodayHabit, celebrates = true) => ({
    habit: h,
    onToggle: onHoldToggle,
    onTap: (x: TodayHabit) => setSheetHabitId(x.id),
    celebrate: celebrates ? celebrations[h.id] : undefined,
  });

  return (
    <>
      {historyId !== null ? (
        <HabitDetailPage habitId={historyId} onClose={closeHistory} />
      ) : (
        <div className="space-y-5 pb-2">
          {/* ---- Header: settings, day + progress, add habit ---- */}
          <div className="relative space-y-3.5">
            <div
              className="dot-grid pointer-events-none absolute -inset-x-4 -top-4 h-44 text-foreground/[0.06]"
              style={{
                WebkitMaskImage: "linear-gradient(180deg, #000 45%, transparent)",
                maskImage: "linear-gradient(180deg, #000 45%, transparent)",
              }}
              aria-hidden
            />
            <header className="relative flex h-11 items-center gap-3">
              <button
                type="button"
                aria-label="Settings"
                onClick={() => setSettingsOpen(true)}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center gap-[3px] rounded-full border border-border/80 bg-card transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="h-[7px] w-[7px] rounded-full bg-q-ember" />
                <span className="h-[7px] w-[7px] rounded-full bg-q-gold" />
                <span className="h-[7px] w-[7px] rounded-full bg-q-sage" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-[28px] font-medium leading-[30px] tracking-[-0.01em]">
                  {dayTitle(viewDate, realToday)}
                </h1>
                <p className="truncate text-[13px] leading-4 text-muted-foreground">
                  {habits.length > 0 && (
                    <>
                      <span className="font-semibold text-foreground">{countText}</span>
                      {" · "}
                    </>
                  )}
                  {shortDate(viewDate)}
                </p>
              </div>
              <Button
                className="h-11 shrink-0 pl-3.5 pr-[18px] font-semibold"
                onClick={() => {
                  setEditTarget(null);
                  setWizardOpen(true);
                }}
              >
                <Plus strokeWidth={2.4} /> Habits
              </Button>
            </header>

            <div className="relative">
              <DayStrip
                days={strip}
                selected={viewDate}
                today={realToday}
                onSelect={setViewDate}
              />
            </div>
          </div>

          {flash && (
            <p
              role="alert"
              className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
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
            <div className="space-y-6">
              {/* ---- What's left: big pebbles (or compact rows) ---- */}
              {toDo.length > 0 ? (
                <div className={cn("relative", compact ? "space-y-2" : "space-y-4")}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {toDo.map((h) => (
                      <motion.div key={h.id} {...itemMotion}>
                        {compact ? (
                          <HabitRow variant="compact" {...rowProps(h)} />
                        ) : (
                          <HabitCard {...rowProps(h)} />
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : due > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3.5 rounded-[36px] border border-dashed border-border px-4 py-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <Check size={18} strokeWidth={3} aria-hidden />
                  </span>
                  <p className="font-display text-lg italic leading-snug">
                    All done{isToday ? " for today" : ""}. Every rep counts.
                  </p>
                </motion.div>
              ) : null}

              {doneList.length > 0 && (
                <section aria-label="Done" className="space-y-2">
                  <SectionLabel>Done · {doneList.length}</SectionLabel>
                  <div className="relative space-y-2">
                    <AnimatePresence initial={false} mode="popLayout">
                      {doneList.map((h) => (
                        <motion.div key={h.id} {...itemMotion}>
                          <HabitRow variant="done" {...rowProps(h, false)} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </section>
              )}

              {skippedList.length > 0 && (
                <section aria-label="Skipped" className="space-y-2">
                  <SectionLabel>Skipped · {skippedList.length}</SectionLabel>
                  <div className="space-y-2">
                    {skippedList.map((h) => (
                      <motion.div key={h.id} {...itemMotion}>
                        <HabitRow variant="skipped" {...rowProps(h, false)} />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {offDay.length > 0 && (
                <section aria-label="Not scheduled" className="space-y-2">
                  <SectionLabel>
                    {isToday ? "Not today" : "Not scheduled"} · {offDay.length}
                  </SectionLabel>
                  <div className="space-y-2">
                    {offDay.map((h) => (
                      <motion.div key={h.id} {...itemMotion}>
                        <HabitRow variant="offday" {...rowProps(h)} />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {paused.length > 0 && isToday && (
                <section aria-label="Paused" className="space-y-2">
                  <SectionLabel>Paused · {paused.length}</SectionLabel>
                  <div className="space-y-2">
                    {paused.map((h) => (
                      <div
                        key={h.id}
                        className="flex h-[66px] items-center gap-3 rounded-[24px] border border-dashed border-border px-4"
                      >
                        <p className="min-w-0 flex-1 truncate font-display text-base text-muted-foreground">
                          {h.name}
                        </p>
                        <Button
                          variant="secondary"
                          className="h-11"
                          disabled={resume.isPending}
                          onClick={() => resume.mutate(h)}
                        >
                          Resume
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      <MilestoneOverlay
        milestone={milestone?.value ?? null}
        colorKey={milestone?.color ?? "ember"}
        onDone={() => setMilestone(null)}
      />
      <HabitWizard open={wizardOpen} onOpenChange={setWizardOpen} editHabit={editTarget} />
      <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DrawerContent aria-describedby={undefined} className="h-[94dvh]">
          <div className="flex items-center justify-between px-5 pb-1 pt-2">
            <DrawerTitle className="font-sans text-lg font-bold tracking-tight">
              Settings
            </DrawerTitle>
            <DrawerClose asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent"
              >
                <X size={18} />
              </button>
            </DrawerClose>
          </div>
          <div
            className="flex-1 overflow-y-auto px-5"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
          >
            <SettingsTab compact={compact} onCompactChange={setCompactPersist} />
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
        onMarkDone={markDoneFromSheet}
        onUndo={(h) => {
          setSheetHabitId(null);
          toggle.mutate(h);
        }}
        onOpenHistory={openHistory}
      />
    </>
  );
}
