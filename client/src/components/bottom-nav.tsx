import { CircleDot, Timer, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type TabKey = "today" | "focus" | "progress";

const TABS: { key: TabKey; label: string; icon: typeof CircleDot }[] = [
  { key: "today", label: "Today", icon: CircleDot },
  { key: "focus", label: "Focus", icon: Timer },
  { key: "progress", label: "Progress", icon: BarChart3 },
];

/**
 * Solid floating tab bar. Content fades out behind it (instead of showing
 * through a translucent bar), so nothing smears under the labels.
 */
export function BottomNav({
  active,
  onSelect,
}: {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
}) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-b from-background/0 via-background/90 to-background"
        style={{ height: "calc(max(env(safe-area-inset-bottom), 12px) + 104px)" }}
      />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-lg px-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        <div className="flex h-16 gap-1 rounded-full border border-border bg-card p-[5px] shadow-[0_10px_30px_rgba(28,27,23,0.14)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = key === active;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full text-[11px] leading-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-accent"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                  />
                )}
                <Icon className="relative h-[22px] w-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
