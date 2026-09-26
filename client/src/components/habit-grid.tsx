import type { TodayHabit } from "@shared/schema";
import { HabitCircle } from "@/components/habit-circle";
import { cn } from "@/lib/utils";

function StreakLine({ habit }: { habit: TodayHabit }) {
  if (habit.streak.atRisk && habit.status !== "done") {
    return <p className="text-[11px] font-medium text-q-amber">don't miss twice</p>;
  }
  if (habit.streak.current > 0) {
    return (
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {habit.streak.current} day{habit.streak.current === 1 ? "" : "s"}
      </p>
    );
  }
  return null;
}

export function HabitGrid({
  habits,
  onToggle,
  onTap,
  compact = false,
}: {
  habits: TodayHabit[];
  onToggle: (habit: TodayHabit) => void;
  onTap: (habit: TodayHabit) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-3 gap-x-3", compact ? "gap-y-4" : "gap-y-6")}>
      {habits.map((habit) => (
        <div key={habit.id} className="flex flex-col items-center gap-2">
          <HabitCircle habit={habit} onToggle={onToggle} onTap={onTap} />
          <div className="max-w-[104px] text-center">
            <p className="truncate text-sm font-medium leading-tight">{habit.name}</p>
            <StreakLine habit={habit} />
          </div>
        </div>
      ))}
    </div>
  );
}
