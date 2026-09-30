import { format } from "date-fns";
import { parseLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";

const R = 17;
const C = 2 * Math.PI * R;

export type StripDay = { date: string; done: number; due: number };

/**
 * The last 7 days (the editable window) as rings: each ring fills with how
 * much of that day's list got done. Tap a day to view or backfill it.
 */
export function DayStrip({
  days,
  selected,
  today,
  onSelect,
}: {
  days: StripDay[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div role="group" aria-label="Last 7 days" className="grid grid-cols-7">
      {days.map(({ date, done, due }) => {
        const isToday = date === today;
        const active = date === selected;
        const frac = due > 0 ? Math.min(1, done / due) : 0;
        const d = parseLocal(date);
        const summary =
          due === 0 ? "nothing due" : done >= due ? "all done" : `${done} of ${due} done`;
        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
            aria-pressed={active}
            aria-label={`${isToday ? "Today, " : ""}${format(d, "EEEE d MMMM")}: ${summary}`}
            className="flex h-[62px] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn(
                "text-[11px] leading-[14px]",
                isToday || active ? "font-bold text-foreground" : "font-medium text-muted-foreground",
              )}
            >
              {isToday ? "Today" : format(d, "EEE")}
            </span>
            <span className="relative flex h-10 w-10 items-center justify-center">
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                className="absolute inset-0"
                aria-hidden
              >
                {/* opaque centre: the header's dot texture stays out of the ring */}
                <circle cx="20" cy="20" r={R} strokeWidth="3" className="fill-transparent stroke-border" />
                {frac > 0 && (
                  <circle
                    cx="20"
                    cy="20"
                    r={R}
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap={frac >= 1 ? "butt" : "round"}
                    strokeDasharray={`${frac * C} ${C}`}
                    transform="rotate(-90 20 20)"
                    className="stroke-foreground"
                    style={{ transition: "stroke-dasharray 0.45s ease" }}
                  />
                )}
                {active && <circle cx="20" cy="20" r="13" className="fill-foreground" />}
              </svg>
              <span
                className={cn(
                  "relative text-sm font-semibold tabular-nums",
                  active && "font-bold text-background",
                )}
              >
                {format(d, "d")}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
