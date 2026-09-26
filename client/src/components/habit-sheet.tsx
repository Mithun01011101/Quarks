import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  CalendarX2,
  Check,
  ChevronRight,
  Flame,
  Minus,
  Pause,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { DayState, TodayHabit } from "@shared/schema";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";
import { parseLocal } from "@/lib/dates";
import { habitSentence } from "@/lib/sentence";
import { quarkColor, type QuarkColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

const STATE_WORDS: Record<DayState, string> = {
  done: "done",
  skipped: "skipped",
  missed: "missed",
  due: "not done yet",
  unscheduled: "not scheduled",
  future: "upcoming",
  "before-start": "before this habit started",
};

function DayDot({ state, color }: { state: DayState; color: QuarkColor }) {
  if (state === "done") {
    return (
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", color.bg)}>
        <Check size={15} strokeWidth={3} style={{ color: color.on }} aria-hidden />
      </span>
    );
  }
  if (state === "skipped") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Minus size={15} strokeWidth={2.4} aria-hidden />
      </span>
    );
  }
  if (state === "missed") {
    return <span className="h-8 w-8 rounded-full border-[1.5px] border-destructive/50" />;
  }
  if (state === "due") {
    return <span className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/70" />;
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center">
      <span className="h-1.5 w-1.5 rounded-full bg-foreground/20" />
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-secondary/70 px-3 py-2.5">
      <p className="font-display text-2xl leading-7">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ListRow({
  icon,
  children,
  hint,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[52px] w-full cursor-pointer items-center gap-3 px-4 text-left text-[15px] transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>svg:first-child]:text-muted-foreground"
    >
      {icon}
      <span className="flex-1">{children}</span>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : (
        <ChevronRight size={16} className="text-muted-foreground" aria-hidden />
      )}
    </button>
  );
}

export function HabitSheet({
  habit,
  date,
  realToday,
  open,
  onOpenChange,
  onEdit,
  onMarkDone,
  onUndo,
  onOpenHistory,
}: {
  habit: TodayHabit | null;
  date: string; // the day being viewed/edited
  realToday: string; // the device's actual today (backfill window anchor)
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (habit: TodayHabit) => void;
  onMarkDone: (habit: TodayHabit) => void;
  onUndo: (habit: TodayHabit) => void;
  onOpenHistory: (habit: TodayHabit) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.today(date) });
    queryClient.invalidateQueries({ queryKey: queryKeys.today(realToday) });
    queryClient.invalidateQueries({ queryKey: queryKeys.progress(realToday) });
  };

  const skip = useMutation({
    mutationFn: () => api.skip(habit!.id, date),
    onSuccess: () => {
      refresh();
      onOpenChange(false);
    },
  });
  const clearSkip = useMutation({
    mutationFn: () => api.undoCompletion(habit!.id, date, realToday),
    onSuccess: () => {
      refresh();
      onOpenChange(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteHabit(habit!.id),
    onSuccess: () => {
      refresh();
      setConfirmDelete(false);
      onOpenChange(false);
    },
  });
  const pause = useMutation({
    mutationFn: () => api.pauseHabit(habit!.id, realToday),
    onSuccess: () => {
      refresh();
      onOpenChange(false);
    },
  });

  if (!habit) return null;
  const color = quarkColor(habit.color);
  const busy = skip.isPending || clearSkip.isPending || remove.isPending || pause.isPending;
  const isToday = date === realToday;
  const dayWord = isToday ? "today" : format(parseLocal(date), "EEE d");
  const atRisk = habit.streak.atRisk && habit.status !== "done";

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <div className="flex items-center gap-2.5 px-5 pt-2">
            <span className={cn("h-3 w-3 shrink-0 rounded-full", color.bg)} aria-hidden />
            <DrawerTitle className="min-w-0 flex-1 truncate text-[26px] leading-[30px]">
              {habit.name}
            </DrawerTitle>
            <DrawerClose asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent"
              >
                <X size={18} />
              </button>
            </DrawerClose>
          </div>

          <div
            className="space-y-4 overflow-y-auto px-5 pt-3"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
          >
            <DrawerDescription asChild>
              <p className="font-display text-base italic leading-[23px] text-foreground/85">
                “{habitSentence(habit)}”
              </p>
            </DrawerDescription>

            {atRisk && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-q-amber-soft px-4 py-3 text-q-amber">
                <Flame size={16} strokeWidth={2.2} className="mt-px shrink-0" aria-hidden />
                <p className="text-[13px] leading-[18px]">
                  <span className="font-semibold">Missed last time.</span> Don't miss twice —
                  one rep {isToday ? "today" : "on this day"} gets you back on track.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Last 7 days
              </p>
              <ol className="grid grid-cols-7 gap-1.5">
                {habit.recent.map(({ date: d, state }) => (
                  <li
                    key={d}
                    className="flex flex-col items-center gap-1"
                    aria-label={`${format(parseLocal(d), "EEEE d MMMM")}: ${STATE_WORDS[state]}`}
                  >
                    <DayDot state={state} color={color} />
                    <span
                      aria-hidden
                      className={cn(
                        "text-[11px] leading-[14px]",
                        d === date ? "font-bold text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {d === realToday ? "Today" : format(parseLocal(d), "EEE")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="day streak" value={habit.streak.current} />
              <Stat label="best streak" value={habit.streak.longest} />
              <Stat label="total reps" value={habit.totalReps} />
            </div>

            <div className="flex gap-2">
              {habit.status === "done" ? (
                <Button
                  variant="secondary"
                  className="h-[52px] flex-1 text-[15px]"
                  disabled={busy}
                  onClick={() => onUndo(habit)}
                >
                  <RotateCcw /> Undo {dayWord}
                </Button>
              ) : (
                <>
                  <Button
                    className="h-[52px] flex-[1.35] text-[15px] font-semibold"
                    disabled={busy}
                    onClick={() => onMarkDone(habit)}
                  >
                    <Check strokeWidth={2.6} /> Mark done
                  </Button>
                  {habit.status === "skipped" ? (
                    <Button
                      variant="secondary"
                      className="h-[52px] flex-1 text-[15px]"
                      disabled={busy}
                      onClick={() => clearSkip.mutate()}
                    >
                      <RotateCcw /> Remove skip
                    </Button>
                  ) : habit.scheduledToday ? (
                    <Button
                      variant="secondary"
                      className="h-[52px] flex-1 text-[15px]"
                      disabled={busy}
                      onClick={() => skip.mutate()}
                    >
                      <CalendarX2 /> Skip {dayWord}
                    </Button>
                  ) : null}
                </>
              )}
            </div>

            <div className="divide-y divide-border overflow-hidden rounded-[20px] border border-border">
              <ListRow
                icon={<CalendarDays size={19} aria-hidden />}
                onClick={() => onOpenHistory(habit)}
                disabled={busy}
              >
                See full history
              </ListRow>
              <ListRow
                icon={<Pencil size={19} aria-hidden />}
                disabled={busy}
                onClick={() => {
                  onOpenChange(false);
                  onEdit(habit);
                }}
              >
                Edit habit
              </ListRow>
              {!habit.pausedOn && (
                <ListRow
                  icon={<Pause size={19} aria-hidden />}
                  hint="keeps your streak"
                  disabled={busy}
                  onClick={() => pause.mutate()}
                >
                  Pause habit
                </ListRow>
              )}
            </div>

            <div className="flex justify-center">
              <Button
                variant="ghost"
                className="h-11 text-[15px] text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 /> Delete habit
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{habit.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the habit and its whole history — {habit.totalReps} completion
              {habit.totalReps === 1 ? "" : "s"}. There's no undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Keep it</AlertDialogCancel>
            <AlertDialogAction disabled={remove.isPending} onClick={() => remove.mutate()}>
              Delete habit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
