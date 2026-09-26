import { Check, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import type { DayState, HabitDetail } from "@shared/schema";
import { quarkColor } from "@/lib/colors";
import { addMonths, format, parse } from "date-fns";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const STATE_WORDS: Record<DayState, string> = {
  done: "done",
  skipped: "skipped",
  missed: "missed",
  due: "not done yet",
  unscheduled: "not scheduled",
  future: "upcoming",
  "before-start": "before this habit started",
};

function monthLabel(month: string): string {
  return format(parse(month + "-01", "yyyy-MM-dd", new Date()), "MMMM yyyy");
}

function shiftMonth(month: string, by: number): string {
  return format(addMonths(parse(month + "-01", "yyyy-MM-dd", new Date()), by), "yyyy-MM");
}

export function MonthHeatCalendar({
  detail,
  today,
  onMonthChange,
  onToggleDay,
  busy = false,
}: {
  detail: HabitDetail;
  today: string;
  onMonthChange: (month: string) => void;
  onToggleDay: (date: string, state: DayState) => void;
  busy?: boolean;
}) {
  const { month, days } = detail.month;
  const color = quarkColor(detail.habit.color);
  const startMonth = detail.habit.startDate.slice(0, 7);
  const currentMonth = today.slice(0, 7);
  const editFloor = (() => {
    // last-7-days window, computed lexically on the server too
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return format(d, "yyyy-MM-dd");
  })();

  const firstWeekday = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)) - 1,
    1,
  ).getDay();

  const editable = (date: string, state: DayState) =>
    date >= editFloor &&
    date <= today &&
    (state === "done" || state === "skipped" || state === "missed" || state === "due");

  return (
    <section
      aria-label={monthLabel(month)}
      className="rounded-3xl border border-border/80 bg-card px-2.5 pb-3.5 pt-2"
    >
      <div className="flex h-11 items-center">
        <h3 className="flex-1 pl-1.5 font-display text-lg">{monthLabel(month)}</h3>
        <button
          type="button"
          aria-label="Previous month"
          disabled={month <= startMonth}
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-30"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          aria-label="Next month"
          disabled={month >= currentMonth}
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 pt-1" aria-hidden>
        {WEEKDAYS.map((w, i) => (
          <p key={i} className="pb-1 text-center text-[11px] font-medium text-muted-foreground">
            {w}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden />
        ))}
        {days.map(({ date, state }) => {
          const dayNum = Number(date.slice(8, 10));
          const canEdit = editable(date, state);
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              disabled={!canEdit || busy}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${format(parse(date, "yyyy-MM-dd", new Date()), "EEEE d MMMM")}: ${STATE_WORDS[state]}${canEdit ? " — tap to change" : ""}`}
              onClick={() => onToggleDay(date, state)}
              className={cn(
                "relative mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-[13px] tabular-nums transition-transform",
                canEdit ? "cursor-pointer active:scale-90" : "cursor-default",
                state === "done" && color.bg,
                state === "skipped" && "bg-secondary",
                state === "missed" && "border-[1.5px] border-destructive/50 text-muted-foreground",
                state === "due" && "border-2 border-dashed border-foreground font-bold",
                (state === "future" || state === "before-start") && "text-muted-foreground/40",
              )}
            >
              {state === "done" ? (
                <Check size={16} strokeWidth={3} style={{ color: color.on }} aria-hidden />
              ) : state === "skipped" ? (
                <Minus size={15} className="text-muted-foreground" aria-hidden />
              ) : state === "unscheduled" ? (
                <span className="h-1 w-1 rounded-full bg-foreground/20" aria-hidden />
              ) : (
                dayNum
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5 px-1.5 pt-3.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded-full", color.bg)} />
            done
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-secondary" />
            skipped
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-[1.5px] border-destructive/60" />
            missed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-[1.5px] border-dashed border-foreground" />
            today
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Tap any of the last 7 days to change it.</p>
      </div>
    </section>
  );
}
