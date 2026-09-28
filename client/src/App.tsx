import { useState } from "react";
import { AnimatePresence, MotionConfig, PresenceContext, motion } from "framer-motion";
import { BottomNav, type TabKey } from "@/components/bottom-nav";
import { useReminders } from "@/hooks/use-reminders";
import { announceTabReselect } from "@/hooks/use-tab-reselect";
import TodayTab from "@/pages/today-tab";
import FocusTab from "@/pages/focus-tab";
import ProgressTab from "@/pages/progress-tab";

export const TAB_ORDER: TabKey[] = ["today", "focus", "progress"];

const EASE = [0.22, 1, 0.36, 1] as const;

export default function App() {
  const [tab, setTab] = useState<TabKey>("today");
  const [direction, setDirection] = useState(1);
  useReminders();

  const switchTab = (next: TabKey) => {
    if (next === tab) {
      // Same tab again: the page returns to its main screen.
      announceTabReselect(tab);
      return;
    }
    setDirection(TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(tab) ? 1 : -1);
    setTab(next);
    window.scrollTo(0, 0);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        <main
          className="relative flex-1 overflow-x-hidden px-4 pb-32"
          style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
        >
          {/* dotted graph paper behind every screen's header; it stays put
              while the tabs slide over it */}
          <div
            aria-hidden
            className="paper-dots pointer-events-none absolute inset-x-0 top-0"
            style={{ height: "calc(max(env(safe-area-inset-top), 16px) + 160px)" }}
          />
          <AnimatePresence mode="popLayout" custom={direction}>
            <motion.div
              key={tab}
              className="relative"
              custom={direction}
              initial={{ opacity: 0, x: direction * 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -48 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              {/* The tab slides out as ONE unit. Without this boundary every
                  animated element inside (list rows with `layout`, the pill
                  thumbs) joins the exit, and after a list reflow framer never
                  signals them done — the old tab stayed mounted, invisible,
                  on top of the new one, swallowing taps. Nested
                  AnimatePresence lists inside a tab still work. */}
              <PresenceContext.Provider value={null}>
                {tab === "today" && <TodayTab />}
                {tab === "focus" && <FocusTab />}
                {tab === "progress" && <ProgressTab />}
              </PresenceContext.Provider>
            </motion.div>
          </AnimatePresence>
        </main>
        <BottomNav active={tab} onSelect={switchTab} />
      </div>
    </MotionConfig>
  );
}
