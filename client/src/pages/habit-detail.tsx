import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { DayState, HabitDetail } from "@shared/schema";
import { MonthHeatCalendar } from "@/components/month-heat-calendar";
import { api, queryKeys } from "@/lib/api";
import { currentMonth, localToday } from "@/lib/dates";
import { habitSentence } from "@/lib/sentence";
import { quarkColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

function Tile({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-3 text-center">
      <p className={cn("font-display text-xl tabular-nums", accent && "text-q-gold")}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

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

  const { data: detail, isLoading } = useQuery<HabitDetail>({ queryKey: detailKey });

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
      <div className="space-y-4 py-2">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <p className="px-1 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const color = quarkColor(detail.habit.color);

  return (
    <div className="space-y-4 py-2">
      <button
        type="button"
        onClick={onClose}
        className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} /> All habits
      </button>

      <div className="flex items-center gap-2.5 px-1">
        <span className={cn("h-3.5 w-3.5 rounded-full", color.bg)} />
        <h2 className="font-display text-2xl font-medium">{detail.habit.name}</h2>
      </div>
      <p className="px-1 font-display text-[15px] italic leading-snug text-foreground/80">
        “{habitSentence(detail.habit)}”
      </p>
      {detail.streak.atRisk && (
        <p className="px-1 text-xs font-medium text-q-gold">
          You missed yesterday — don't miss twice.
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        <Tile label="streak" value={detail.streak.current} accent={detail.streak.atRisk} />
        <Tile label="best" value={detail.streak.longest} />
        <Tile label="reps" value={detail.totalReps} />
        <Tile label="30d rate" value={`${detail.rate30d}%`} />
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
