import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Flame } from "lucide-react";
import type { DayState, HabitDetail } from "@shared/schema";
import { MonthHeatCalendar } from "@/components/month-heat-calendar";
import { api, queryKeys } from "@/lib/api";
import { currentMonth, localToday } from "@/lib/dates";
import { habitSentence } from "@/lib/sentence";
import { quarkColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-border/80 bg-card px-1.5 py-2.5 text-center">
      <p className="font-display text-[22px] leading-[26px]">{value}</p>
      <p className="text-[11px] leading-[14px] text-muted-foreground">{label}</p>
    </div>
  );
}

function BackButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Back"
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border/80 bg-card transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronLeft size={20} strokeWidth={2.2} />
    </button>
  );
}

/** One habit's full history: stats + month calendar (last 7 days editable). */
export function HabitDetailPage({
  habitId,
  onClose,
}: {
  habitId: number;
  onClose: () => void;
}) {
  const today = localToday();
  const [month, setMonth] = useState(currentMonth());
  const queryClient = useQueryClient();
  const detailKey = queryKeys.habitDetail(habitId, month, today);

  const { data: detail, isLoading, error } = useQuery<HabitDetail>({ queryKey: detailKey });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: detailKey });
    queryClient.invalidateQueries({ queryKey: queryKeys.today(today) });
    queryClient.invalidateQueries({ queryKey: queryKeys.progress(today) });
  };

  const editDay = useMutation({
    mutationFn: async ({ date, state }: { date: string; state: DayState }) => {
      if (state === "done" || state === "skipped") {
        return api.undoCompletion(habitId, date, today);
      }
      return api.complete(habitId, { date, source: "backfill", today });
    },
    onSettled: refresh,
  });

  if (isLoading || !detail) {
    return (
      <div className="space-y-4 pb-2">
        <header className="flex h-11 items-center gap-3">
          <BackButton onClose={onClose} />
        </header>
        <p className={cn("px-1 text-sm", error ? "text-destructive" : "text-muted-foreground")}>
          {error ? `Couldn't load this habit: ${(error as Error).message}` : "Loading…"}
        </p>
      </div>
    );
  }

  const color = quarkColor(detail.habit.color);

  return (
    <div className="space-y-4 pb-2">
      <header className="flex h-11 items-center gap-3">
        <BackButton onClose={onClose} />
        <span className={cn("h-3 w-3 shrink-0 rounded-full", color.bg)} aria-hidden />
        <h2 className="min-w-0 flex-1 truncate font-display text-[26px] font-medium leading-[30px]">
          {detail.habit.name}
        </h2>
      </header>

      <p className="px-1 font-display text-base italic leading-[23px] text-foreground/85">
        “{habitSentence(detail.habit)}”
      </p>
      {detail.streak.atRisk && (
        <p className="flex items-center gap-1.5 px-1 text-[13px] font-semibold text-q-amber">
          <Flame size={14} strokeWidth={2.2} aria-hidden /> Missed last time — don't miss twice.
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        <Tile label="day streak" value={detail.streak.current} />
        <Tile label="best" value={detail.streak.longest} />
        <Tile label="reps" value={detail.totalReps} />
        <Tile label="30-day rate" value={`${detail.rate30d}%`} />
      </div>

      <MonthHeatCalendar
        detail={detail}
        today={today}
        onMonthChange={setMonth}
        onToggleDay={(date, state) => editDay.mutate({ date, state })}
        busy={editDay.isPending}
      />
    </div>
  );
}
