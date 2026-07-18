import { Check, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import type { DayState, HabitDetail } from "@shared/schema";
import { quarkHsl } from "@/lib/colors";
import { addMonths, format, parse } from "date-fns";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

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
  const color = detail.habit.color;
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
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between pb-3">
        <p className="font-display text-base">{monthLabel(month)}</p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            disabled={month <= startMonth}
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={month >= currentMonth}
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w, i) => (
          <p key={i} className="pb-1 text-center text-[10px] font-medium text-muted-foreground">
            {w}
          </p>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map(({ date, state }) => {
          const dayNum = Number(date.slice(8, 10));
          const canEdit = editable(date, state);
          return (
            <button
              key={date}
              type="button"
              disabled={!canEdit || busy}
              aria-label={`${date}: ${state}${canEdit ? " — tap to change" : ""}`}
              onClick={() => onToggleDay(date, state)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg text-[11px] tabular-nums transition-transform",
                canEdit && "cursor-pointer active:scale-90",
                !canEdit && "cursor-default",
                state === "future" || state === "before-start"
                  ? "text-muted-foreground/30"
                  : "text-muted-foreground",
              )}
              style={{
                backgroundColor:
                  state === "done"
                    ? quarkHsl(color, 1)
                    : state === "skipped"
                      ? quarkHsl(color, 0.2)
                      : "transparent",
                boxShadow:
                  state === "missed"
                    ? "inset 0 0 0 1px hsl(4 60% 50% / 0.4)"
                    : state === "due"
                      ? "inset 0 0 0 1px hsl(40 30% 70% / 0.8)"
                      : undefined,
              }}
            >
              {state === "done" ? (
                <Check size={13} strokeWidth={3} className="text-background" />
              ) : state === "skipped" ? (
                <Minus size={12} className="text-muted-foreground" />
              ) : state === "unscheduled" ? (
                <span className="h-1 w-1 rounded-full bg-foreground/15" />
              ) : (
                dayNum
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 pt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: quarkHsl(color, 1) }} />
          done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: quarkHsl(color, 0.2) }} />
          skipped
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded" style={{ boxShadow: "inset 0 0 0 1px hsl(4 60% 50% / 0.5)" }} />
          missed
        </span>
        <span className="ml-auto">Tap days in the last week to edit</span>
      </div>
    </div>
  );
}
