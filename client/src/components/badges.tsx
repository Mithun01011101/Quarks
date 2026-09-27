import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The ⚡ badge on habit bubbles — the habit's current streak (owner's choice
 * over total reps). Yellow gradient, dark numbers. Hidden at zero.
 */
export function BoltBadge({
  count,
  size = "md",
  className,
}: {
  count: number;
  size?: "md" | "sm";
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "bolt-badge inline-flex shrink-0 items-center font-bold tabular-nums shadow-sm",
        size === "md"
          ? "h-7 gap-1 rounded-[14px] pl-[9px] pr-[11px] text-sm"
          : "h-[26px] gap-[3px] rounded-[13px] pl-2 pr-2.5 text-[13px]",
        className,
      )}
    >
      <Zap size={size === "md" ? 13 : 12} fill="currentColor" strokeWidth={0} aria-hidden />
      {count}
    </span>
  );
}
