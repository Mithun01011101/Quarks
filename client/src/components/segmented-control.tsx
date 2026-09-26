import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Full-width pill switch (Progress | Milestones, Any time | Set a time).
 * Buttons carry aria-pressed; the white thumb slides between them.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const thumbId = useId();
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex h-[50px] gap-[3px] rounded-full bg-secondary p-[3px]", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "font-semibold text-foreground" : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={thumbId}
                className="absolute inset-0 rounded-full bg-card shadow-sm dark:bg-accent"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
