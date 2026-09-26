import { Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** The ⚡ total-reps badge — yellow gradient, dark numbers. Hidden at zero. */
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

/** "Don't miss twice" — shown when the last scheduled day was missed. */
export function RiskChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-[5px] rounded-[14px] bg-q-amber-soft pl-[9px] pr-[11px] text-[13px] font-semibold text-q-amber",
        className,
      )}
    >
      <Flame size={14} strokeWidth={2.2} aria-hidden />
      Don't miss twice
    </span>
  );
}
