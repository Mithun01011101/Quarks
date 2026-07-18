import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { AppHeader } from "@/components/app-header";
import { BottomNav, type TabKey } from "@/components/bottom-nav";
import { useReminders } from "@/hooks/use-reminders";
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
    if (next === tab) return;
    setDirection(TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(tab) ? 1 : -1);
    setTab(next);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        <AppHeader tab={tab} />
        <main className="flex-1 overflow-x-hidden px-4 pb-28 pt-2">
          <AnimatePresence mode="popLayout" custom={direction}>
            <motion.div
              key={tab}
              custom={direction}
              initial={{ opacity: 0, x: direction * 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -48 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              {tab === "today" && <TodayTab />}
              {tab === "focus" && <FocusTab />}
              {tab === "progress" && <ProgressTab />}
            </motion.div>
          </AnimatePresence>
        </main>
        <BottomNav active={tab} onSelect={switchTab} />
      </div>
    </MotionConfig>
  );
}
