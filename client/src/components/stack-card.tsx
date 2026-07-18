import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import type { TodayHabit, TodayStack } from "@shared/schema";
import { HabitCircle } from "@/components/habit-circle";
import { ChainProgress } from "@/components/chain-progress";
import { BurstCelebration } from "@/components/burst-celebration";
import { cn } from "@/lib/utils";

export function StackCard({
  stack,
  onToggle,
  onTapHabit,
  onEdit,
}: {
  stack: TodayStack;
  onToggle: (habit: TodayHabit) => void;
  onTapHabit: (habit: TodayHabit) => void;
  onEdit: (stack: TodayStack) => void;
}) {
  const members = stack.habits;
  const scheduled = members.filter((m) => m.habit.scheduledToday);
  const allDone =
    scheduled.length > 0 && scheduled.every((m) => m.habit.status === "done");
  const upNextId = members.find(
    (m) => m.habit.scheduledToday && m.habit.status === null,
  )?.habit.id;

  // One-time mini-burst on the chain when the whole stack lands.
  const prevAllDone = useRef(allDone);
  const [chainBurst, setChainBurst] = useState<number | null>(null);
  useEffect(() => {
    if (allDone && !prevAllDone.current) setChainBurst(stack.id * 131);
    prevAllDone.current = allDone;
  }, [allDone, stack.id]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight">{stack.name}</p>
          <p className="truncate text-xs italic text-muted-foreground">
            {stack.anchor}…
          </p>
        </div>
        <button
          type="button"
          aria-label={`Edit stack ${stack.name}`}
          onClick={() => onEdit(stack)}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Pencil size={14} />
        </button>
      </div>

      <div className="relative py-3">
        {chainBurst !== null && (
          <BurstCelebration
            colorKey={stack.color}
            seed={chainBurst}
            onDone={() => setChainBurst(null)}
          />
        )}
        <ChainProgress stack={stack} />
      </div>

      <div className="space-y-2.5">
        {members.map((m) => {
          const habit = m.habit;
          const done = habit.status === "done";
          return (
            <div key={m.id} className="flex items-center gap-3">
              <HabitCircle habit={habit} size="sm" onToggle={onToggle} onTap={onTapHabit} />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm",
                    done && "text-muted-foreground line-through decoration-1",
                  )}
                >
                  {habit.tinyVersion || habit.action}
                </p>
              </div>
              {habit.id === upNextId && (
                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                  Up next
                </span>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <p className="pt-3 font-display text-sm italic text-q-sage">
          Chain complete.
        </p>
      )}
    </div>
  );
}
