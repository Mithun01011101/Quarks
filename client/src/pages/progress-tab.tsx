import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, SlidersHorizontal, X } from "lucide-react";
import type { ProgressOverview } from "@shared/schema";
import { HabitDetailPage } from "@/pages/habit-detail";
import { AnimatedNumber } from "@/components/animated-number";
import { SegmentedControl } from "@/components/segmented-control";
import { Switch } from "@/components/ui/switch";
import { PaperHeader } from "@/components/paper-header";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useTabReselect } from "@/hooks/use-tab-reselect";
import { queryKeys } from "@/lib/api";
import { localToday } from "@/lib/dates";
import { quarkColor, quarkHsl } from "@/lib/colors";
import { cn } from "@/lib/utils";

const MILESTONES = [7, 14, 30, 60, 100, 180, 365];

// ---- The widget catalog: every stat the user can pin, iOS-widget style ----
// (Total repetitions is the big number above the grid, so it isn't a widget.)

type WidgetDef = {
  key: string;
  label: string;
  caption: string;
  value: (o: ProgressOverview) => number | string;
};

const WIDGET_CATALOG: WidgetDef[] = [
  { key: "bestStreak", label: "Best streak", caption: "days, all time", value: (o) => o.bestStreak },
  { key: "rate30d", label: "30-day rate", caption: "of scheduled reps done", value: (o) => `${o.rate30d}%` },
  {
    key: "perfectDays",
    label: "Perfect days",
    caption: "all-done days, last 30",
    value: (o) =>
      o.last30.filter((d) => {
        const due = d.scheduled - d.scheduledSkipped;
        return due > 0 && d.scheduledDone >= due;
      }).length,
  },
  {
    key: "weekDone",
    label: "This week",
    caption: "reps in the last 7 days",
    value: (o) => o.last30.slice(-7).reduce((sum, d) => sum + d.done, 0),
  },
  {
    key: "topStreak",
    label: "Live streak",
    caption: "longest right now",
    value: (o) => Math.max(0, ...o.habits.map((h) => h.streak.current)),
  },
  { key: "activeHabits", label: "Active habits", caption: "currently in rotation", value: (o) => o.activeHabits },
  { key: "focusMinutes", label: "Focus minutes", caption: "time held, all time", value: (o) => o.focusMinutes },
];

const DEFAULT_WIDGETS = ["bestStreak", "rate30d", "perfectDays", "weekDone"];
const WIDGETS_KEY = "quarks-widgets";

function loadWidgets(): string[] {
  try {
    const raw = localStorage.getItem(WIDGETS_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return DEFAULT_WIDGETS;
    // The old "Repetitions" widget duplicated the big number; its slot
    // becomes "This week".
    const migrated = arr.map((k: unknown) => (k === "reps" ? "weekDone" : k));
    return WIDGET_CATALOG.map((w) => w.key).filter((k) => migrated.includes(k));
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function SectionLabel({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      className="on-paper px-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground"
    >
      {children}
    </p>
  );
}

function WidgetGrid({
  overview,
  selected,
  onEdit,
}: {
  overview: ProgressOverview;
  selected: string[];
  onEdit: () => void;
}) {
  const widgets = WIDGET_CATALOG.filter((w) => selected.includes(w.key));
  return (
    <section aria-labelledby="widgets-title" className="space-y-2">
      <div className="flex h-11 items-center justify-between">
        <SectionLabel id="widgets-title">Widgets</SectionLabel>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-secondary pl-3 pr-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal size={15} aria-hidden /> Edit
        </button>
      </div>
      {widgets.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
          No widgets pinned. Tap Edit to choose your stats.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {widgets.map((w) => {
            const value = w.value(overview);
            return (
              <div
                key={w.key}
                className="flex min-h-[100px] flex-col gap-0.5 rounded-3xl border border-border/80 bg-card px-4 py-3.5"
              >
                <p className="text-[13px] font-semibold text-muted-foreground">{w.label}</p>
                <p className="font-display text-[32px] leading-9">
                  {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
                </p>
                <p className="text-xs text-muted-foreground">{w.caption}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RepetitionBars({
  overview,
  onOpen,
}: {
  overview: ProgressOverview;
  onOpen: (id: number) => void;
}) {
  const sorted = [...overview.habits].sort((a, b) => b.reps - a.reps);
  const max = Math.max(1, ...sorted.map((h) => h.reps));
  return (
    <section aria-labelledby="by-habit-title" className="space-y-1">
      <SectionLabel id="by-habit-title">By habit</SectionLabel>
      <div>
        {sorted.map((h) => {
          const pct = h.reps === 0 ? 0 : Math.max(3, Math.round((h.reps / max) * 100));
          const note = h.streak.atRisk
            ? "Don't miss twice"
            : h.streak.current > 0
              ? `${h.streak.current}-day streak`
              : "";
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onOpen(h.id)}
              aria-label={`${h.name}: ${h.reps} ${h.reps === 1 ? "rep" : "reps"}${note ? `, ${note.toLowerCase()}` : ""}. Open history.`}
              className="on-paper block w-full cursor-pointer rounded-2xl px-1 py-2 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-baseline gap-2">
                <span className="max-w-[60%] shrink-0 truncate font-display text-[17px] leading-[22px]">
                  {h.name}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-xs",
                    // the streak reads clearly over the dots (owner, 2026-09-30)
                    h.streak.atRisk ? "font-semibold text-q-amber" : "font-medium text-foreground/80",
                  )}
                >
                  {note}
                </span>
                <span className="text-[15px] font-semibold tabular-nums">{h.reps}</span>
              </span>
              <span className="mt-1.5 block h-2 w-full overflow-hidden rounded-full bg-secondary">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: quarkHsl(h.color) }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MilestonesView({
  overview,
  onOpen,
}: {
  overview: ProgressOverview;
  onOpen: (id: number) => void;
}) {
  return (
    <div className="space-y-3">
      {overview.habits.map((h) => {
        const color = quarkColor(h.color);
        const achieved = MILESTONES.filter((m) => m <= h.streak.longest);
        const next = MILESTONES.find((m) => m > h.streak.current) ?? null;
        const pct = next ? Math.min(100, Math.round((h.streak.current / next) * 100)) : 100;
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onOpen(h.id)}
            className="block w-full cursor-pointer rounded-3xl border border-border/80 bg-card px-4 py-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2.5">
              <span className={cn("h-3 w-3 shrink-0 rounded-full", color.bg)} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-display text-[17px]">{h.name}</span>
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
            </span>
            {next ? (
              <>
                <span className="block pt-2.5 text-[13px] text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">
                    {h.streak.current}
                  </span>{" "}
                  of {next} days — {next - h.streak.current} to the next milestone
                </span>
                <span className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: quarkHsl(h.color) }}
                  />
                </span>
              </>
            ) : (
              <span className="block pt-2.5 text-[13px] text-muted-foreground">
                Every milestone reached. Remarkable.
              </span>
            )}
            {achieved.length > 0 && (
              <span className="flex flex-wrap gap-1.5 pt-3">
                {achieved.map((m) => (
                  <span
                    key={m}
                    aria-label={`${m}-day milestone reached`}
                    className="bolt-badge rounded-lg px-2 py-0.5 text-[11px] font-bold"
                  >
                    {m}
                  </span>
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function ProgressTab() {
  const today = localToday();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<"progress" | "milestones">("progress");
  const [widgets, setWidgets] = useState<string[]>(loadWidgets);
  const [editOpen, setEditOpen] = useState(false);
  const scrollBack = useRef(0);

  // Tapping the Progress tab again closes a habit's history page.
  useTabReselect("progress", () => {
    setSelectedId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const { data, isLoading, error } = useQuery<ProgressOverview>({
    queryKey: queryKeys.progress(today),
  });

  const toggleWidget = (key: string) => {
    setWidgets((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : WIDGET_CATALOG.map((w) => w.key).filter((k) => prev.includes(k) || k === key);
      try {
        localStorage.setItem(WIDGETS_KEY, JSON.stringify(next));
      } catch {
        // best-effort
      }
      return next;
    });
  };

  const openHabit = (id: number) => {
    scrollBack.current = window.scrollY;
    setSelectedId(id);
    window.scrollTo(0, 0);
  };

  if (selectedId !== null) {
    return (
      <HabitDetailPage
        habitId={selectedId}
        onClose={() => {
          setSelectedId(null);
          const y = scrollBack.current;
          requestAnimationFrame(() => window.scrollTo(0, y));
        }}
      />
    );
  }

  const heading = (
    <h1 className="px-1 font-display text-[30px] font-medium leading-[34px] tracking-[-0.01em]">
      Progress
    </h1>
  );
  const title = <PaperHeader>{heading}</PaperHeader>;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {title}
        <p className="on-paper px-1 py-8 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        {title}
        <p className="on-paper px-1 py-8 text-sm text-destructive">
          Couldn't load progress: {(error as Error).message}
        </p>
      </div>
    );
  }
  if (!data || data.habits.length === 0) {
    return (
      <div className="space-y-4">
        {title}
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <h2 className="on-paper font-display text-xl">Nothing to chart yet</h2>
          <p className="on-paper max-w-[240px] text-sm text-muted-foreground">
            Create a habit on the Today tab and complete it — your progress starts here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-2">
      <PaperHeader className="space-y-4">
        {heading}
        <SegmentedControl
          label="Progress view"
          options={[
            { value: "progress", label: "Progress" },
            { value: "milestones", label: "Milestones" },
          ]}
          value={view}
          onChange={setView}
        />
      </PaperHeader>

      {view === "progress" ? (
        <>
          <div className="space-y-1 rounded-[28px] border border-border/80 bg-card px-6 py-5">
            <p className="font-display text-[64px] font-medium leading-[64px] tracking-[-0.02em]">
              <span className="sr-only">Total repetitions: </span>
              <AnimatedNumber value={data.totalReps} />
            </p>
            <p className="font-display text-[17px] leading-[23px] text-foreground/90">
              <span className="underline decoration-bolt decoration-2 underline-offset-4">
                {data.totalReps === 1 ? "vote" : "votes"}
              </span>{" "}
              toward the person I'm becoming
            </p>
          </div>

          <WidgetGrid overview={data} selected={widgets} onEdit={() => setEditOpen(true)} />

          <RepetitionBars overview={data} onOpen={openHabit} />
        </>
      ) : (
        <MilestonesView overview={data} onOpen={openHabit} />
      )}

      {/* Widget picker */}
      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <DrawerContent aria-describedby={undefined}>
          <div className="flex items-center justify-between px-5 pb-1 pt-2">
            <DrawerTitle className="font-sans text-lg font-bold tracking-tight">
              Choose your widgets
            </DrawerTitle>
            <DrawerClose asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-accent"
              >
                <X size={18} />
              </button>
            </DrawerClose>
          </div>
          <div
            className="overflow-y-auto px-5"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
          >
            {WIDGET_CATALOG.map((w) => (
              <div key={w.key} className="flex min-h-[60px] items-center justify-between gap-3 px-1 py-2">
                <div>
                  <label htmlFor={`widget-${w.key}`} className="text-[15px] font-medium">
                    {w.label}
                  </label>
                  <p className="text-[13px] text-muted-foreground">{w.caption}</p>
                </div>
                <Switch
                  id={`widget-${w.key}`}
                  checked={widgets.includes(w.key)}
                  onCheckedChange={() => toggleWidget(w.key)}
                />
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
