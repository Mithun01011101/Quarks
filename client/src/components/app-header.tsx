import type { TabKey } from "@/components/bottom-nav";

const TITLES: Record<Exclude<TabKey, "today">, { title: string; subtitle: string }> = {
  focus: { title: "Focus", subtitle: "Give one habit your full attention." },
  progress: {
    title: "Habit progress",
    subtitle: "Every action is a vote for the person you're becoming.",
  },
};

export function AppHeader({ tab }: { tab: TabKey }) {
  // The Today tab draws its own header (mark, Habits pill, date strip).
  if (tab === "today") return null;
  const { title, subtitle } = TITLES[tab];
  return (
    <header className="px-5 pb-1 pt-8">
      <h1 className="font-display text-3xl font-medium tracking-tight">{title}</h1>
      <p className="pt-1 text-sm text-muted-foreground">{subtitle}</p>
    </header>
  );
}
