import type { TodayStack } from "@shared/schema";
import { quarkHsl } from "@/lib/colors";
import { cn } from "@/lib/utils";

/**
 * The stack's chain: one dot per member habit (in its own color), segments
 * lighting up behind each completed link.
 */
export function ChainProgress({ stack }: { stack: TodayStack }) {
  const members = stack.habits;
  if (members.length === 0) return null;

  return (
    <div className="flex items-center" aria-hidden>
      {members.map((m, i) => {
        const done = m.habit.status === "done";
        const prevDone = i > 0 && members[i - 1].habit.status === "done";
        return (
          <div key={m.id} className="flex flex-1 items-center first:flex-none">
            {i > 0 && (
              <span
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  prevDone && done ? "" : "bg-border",
                )}
                style={
                  prevDone && done
                    ? { backgroundColor: quarkHsl(stack.color, 0.7) }
                    : undefined
                }
              />
            )}
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border transition-colors"
              style={{
                backgroundColor: done ? quarkHsl(m.habit.color, 1) : "transparent",
                borderColor: quarkHsl(m.habit.color, done ? 1 : 0.5),
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
