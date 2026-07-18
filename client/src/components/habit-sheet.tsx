import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarX2, Flame, Pause, Pencil, RotateCcw, Trash2 } from "lucide-react";
import type { TodayHabit } from "@shared/schema";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
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
import { habitSentence } from "@/lib/sentence";
import { quarkColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 rounded-2xl bg-secondary/60 px-3 py-3 text-center">
      <p className="font-display text-xl tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function HabitSheet({
  habit,
  date,
  realToday,
  open,
  onOpenChange,
  onEdit,
}: {
  habit: TodayHabit | null;
  date: string; // the day being viewed/edited
  realToday: string; // the device's actual today (backfill window anchor)
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (habit: TodayHabit) => void;
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
  const clearMark = useMutation({
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
  const busy = skip.isPending || clearMark.isPending || remove.isPending || pause.isPending;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <div className="flex items-center gap-2">
              <span className={cn("h-3 w-3 rounded-full", color.bg)} />
              <DrawerTitle>{habit.name}</DrawerTitle>
            </div>
            <DrawerDescription asChild>
              <p className="font-display text-base italic leading-snug text-foreground/90">
                “{habitSentence(habit)}”
              </p>
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex gap-2 px-5 pt-1">
            <Stat label="streak" value={habit.streak.current} />
            <Stat label="best" value={habit.streak.longest} />
            <Stat label="total reps" value={habit.totalReps} />
          </div>
          {habit.streak.atRisk && habit.status !== "done" && (
            <div className="mx-5 mt-3 rounded-2xl bg-charcoal px-4 py-3 text-charcoal-foreground">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <Flame size={14} className="text-q-gold" /> Never miss twice
              </p>
              <p className="pt-1 text-xs text-charcoal-foreground/70">
                You missed yesterday. One rep{" "}
                <span className="font-semibold text-q-gold">today</span> keeps the
                streak alive.
              </p>
            </div>
          )}

          <DrawerFooter className="gap-2 pt-4">
            {habit.status === "done" && (
              <Button variant="secondary" disabled={busy} onClick={() => clearMark.mutate()}>
                <RotateCcw /> Undo today's completion
              </Button>
            )}
            {habit.status === "skipped" && (
              <Button variant="secondary" disabled={busy} onClick={() => clearMark.mutate()}>
                <RotateCcw /> Remove today's skip
              </Button>
            )}
            {habit.status === null && (
              <Button variant="secondary" disabled={busy} onClick={() => skip.mutate()}>
                <CalendarX2 /> Skip today
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                onEdit(habit);
              }}
            >
              <Pencil /> Edit habit
            </Button>
            {!habit.pausedOn && (
              <Button variant="outline" disabled={busy} onClick={() => pause.mutate()}>
                <Pause /> Pause habit
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> Delete habit
            </Button>
          </DrawerFooter>
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
