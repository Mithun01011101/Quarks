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
 * Glossy floating tab bar: see-through with a blur, so the page shows softly
 * behind it — the pre-redesign bar, brought back at the owner's request.
 * Keep it `bg-transparent`: the old build asked for `bg-card/90`, but its
 * colour tokens silently dropped that class, so the bar the owner knew was
 * clear. Its computed styles were measured against the old build.
 */
export function BottomNav({
  active,
  onSelect,
}: {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
}) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-lg px-4"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="flex items-center justify-between rounded-full border border-border bg-transparent px-2 py-1.5 shadow-lg shadow-black/20 backdrop-blur-md">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-x-1 inset-y-0 rounded-full bg-accent"
                  transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                />
              )}
              <Icon className="relative h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="relative">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
