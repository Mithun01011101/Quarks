import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import type { ProgressOverview } from "@shared/schema";
import { HabitDetailPage } from "@/pages/habit-detail";
import { AnimatedNumber } from "@/components/animated-number";
import { Switch } from "@/components/ui/switch";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { queryKeys } from "@/lib/api";
import { localToday } from "@/lib/dates";
import { quarkColor, quarkHsl } from "@/lib/colors";
import { cn } from "@/lib/utils";

const MILESTONES = [7, 14, 30, 60, 100, 180, 365];

// ---- The widget catalog: every stat the user can pin, iOS-widget style ----

type WidgetDef = {
  key: string;
  label: string;
  caption: string;
  value: (o: ProgressOverview) => number | string;
};

const WIDGET_CATALOG: WidgetDef[] = [
  { key: "reps", label: "Repetitions", caption: "votes cast, all time", value: (o) => o.totalReps },
  { key: "bestStreak", label: "Best streak", caption: "days, all time", value: (o) => o.bestStreak },
  { key: "rate30d", label: "30-day rate", caption: "of scheduled reps done", value: (o) => `${o.rate30d}%` },
  {
    key: "topStreak",
    label: "Live streak",
    caption: "longest right now",
    value: (o) => Math.max(0, ...o.habits.map((h) => h.streak.current)),
  },
  {
    key: "weekDone",
    label: "This week",
    caption: "reps in the last 7 days",
    value: (o) => o.last30.slice(-7).reduce((sum, d) => sum + d.done, 0),
  },
  {
    key: "perfectDays",
    label: "Perfect days",
    caption: "all-done days, last 30",
    value: (o) => o.last30.filter((d) => d.scheduled > 0 && d.done >= d.scheduled).length,
  },
  { key: "activeHabits", label: "Active habits", caption: "currently in rotation", value: (o) => o.activeHabits },
  { key: "focusMinutes", label: "Focus minutes", caption: "time held, all time", value: (o) => o.focusMinutes },
];

const DEFAULT_WIDGETS = ["reps", "bestStreak", "rate30d", "perfectDays"];
const WIDGETS_KEY = "quarks-widgets";

function loadWidgets(): string[] {
  try {
    const raw = localStorage.getItem(WIDGETS_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((k: unknown) => WIDGET_CATALOG.some((w) => w.key === k))
      : DEFAULT_WIDGETS;
  } catch {
    return DEFAULT_WIDGETS;
  }
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
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Widgets
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <SlidersHorizontal size={12} /> Edit
        </button>
      </div>
      {widgets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          No widgets pinned. Tap Edit to choose your stats.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {widgets.map((w) => (
            <div key={w.key} className="rounded-3xl border border-border/70 bg-card px-4 py-4">
              <p className="text-xs font-semibold text-muted-foreground">{w.label}</p>
              <p className="font-display pt-1 text-3xl tabular-nums">
                {typeof w.value(overview) === "number" ? (
                  <AnimatedNumber value={w.value(overview) as number} />
                ) : (
                  w.value(overview)
                )}
              </p>
              <p className="pt-0.5 text-[10px] text-muted-foreground">{w.caption}</p>
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div className="space-y-2">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Repetitions by habit
      </p>
      <div className="space-y-2.5">
        {sorted.map((h) => {
          const pct = Math.max(9, Math.round((h.reps / max) * 100));
          const wide = pct >= 26;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onOpen(h.id)}
              className="block w-full cursor-pointer text-left"
            >
              <p className="flex items-baseline justify-between px-1 pb-1">
                <span className="font-display text-[15px]">{h.name}</span>
                {h.streak.atRisk ? (
                  <span className="text-[11px] font-medium text-q-gold">don't miss twice</span>
                ) : h.streak.current > 0 ? (
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {h.streak.current} day streak
                  </span>
                ) : null}
              </p>
              <div className="h-9 w-full overflow-hidden rounded-full bg-secondary/70">
                <div
                  className="flex h-full items-center justify-end rounded-full pr-3"
                  style={{
                    width: `${pct}%`,
                    backgroundImage: `linear-gradient(90deg, ${quarkHsl(h.color, 0.75)}, ${quarkHsl(h.color, 1)})`,
                  }}
                >
                  {wide && (
                    <span className="text-sm font-semibold tabular-nums text-white drop-shadow-sm">
                      {h.reps}
                    </span>
                  )}
                </div>
                {!wide && (
                  <span className="relative -top-7 float-right pr-3 text-sm font-semibold tabular-nums text-muted-foreground">
                    {h.reps}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
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
    <div className="space-y-2.5">
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
            className="block w-full cursor-pointer rounded-3xl border border-border/70 bg-card px-4 py-4 text-left transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center gap-2.5">
              <span className={cn("h-3 w-3 shrink-0 rounded-full", color.bg)} />
              <p className="min-w-0 flex-1 truncate font-display text-[15px]">{h.name}</p>
              <ChevronRight size={15} className="shrink-0 text-muted-foreground" />
            </div>
            {next ? (
              <>
                <p className="pt-2.5 text-xs text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">
                    {h.streak.current}
                  </span>{" "}
                  of {next} days — {next - h.streak.current} to the next milestone
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary/70">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: quarkHsl(h.color, 0.9) }}
                  />
                </div>
              </>
            ) : (
              <p className="pt-2.5 text-xs text-muted-foreground">
                Every milestone reached. Remarkable.
              </p>
            )}
            {achieved.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2.5">
                {achieved.map((m) => (
                  <span
                    key={m}
                    className="bolt-badge rounded-lg px-2 py-0.5 text-[10px] font-bold text-white"
                  >
                    {m}
                  </span>
                ))}
              </div>
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

  if (selectedId !== null) {
    return <HabitDetailPage habitId={selectedId} onClose={() => setSelectedId(null)} />;
  }

  if (isLoading) {
    return <p className="px-1 py-8 text-sm text-muted-foreground">Loading…</p>;
  }
  if (error) {
    return (
      <p className="px-1 py-8 text-sm text-destructive">
        Couldn't load progress: {(error as Error).message}
      </p>
    );
  }
  if (!data || data.habits.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <h2 className="font-display text-xl">Nothing to chart yet</h2>
        <p className="max-w-[240px] text-sm text-muted-foreground">
          Create a habit on the Today tab and complete it — your progress
          starts here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      {/* Progress | Milestones pill tabs */}
      <div className="flex gap-2">
        {(["progress", "milestones"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cn(
              "cursor-pointer rounded-full border px-4 py-2 text-sm font-medium capitalize transition-colors",
              view === v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/70 bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "progress" ? (
        <>
          <WidgetGrid overview={data} selected={widgets} onEdit={() => setEditOpen(true)} />

          <div className="rounded-[2rem] border border-border/70 bg-card px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Total repetitions
            </p>
            <p className="font-display pt-1 text-6xl font-medium tabular-nums">
              {data.totalReps}
            </p>
            <p className="font-display pt-3 text-[15px] leading-snug text-foreground/85">
              I've made{" "}
              <span className="underline decoration-q-ember decoration-2 underline-offset-4">
                {data.totalReps} vote{data.totalReps === 1 ? "" : "s"}
              </span>{" "}
              toward the person I'm becoming.
            </p>
          </div>

          <RepetitionBars overview={data} onOpen={setSelectedId} />
        </>
      ) : (
        <MilestonesView overview={data} onOpen={setSelectedId} />
      )}

      {/* Widget picker */}
      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <DrawerContent aria-describedby={undefined}>
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="font-sans text-lg font-bold tracking-tight">
              Choose your widgets
            </DrawerTitle>
          </DrawerHeader>
          <div
            className="space-y-1 overflow-y-auto px-5"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
          >
            {WIDGET_CATALOG.map((w) => (
              <div
                key={w.key}
                className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium">{w.label}</p>
                  <p className="text-xs text-muted-foreground">{w.caption}</p>
                </div>
                <Switch
                  checked={widgets.includes(w.key)}
                  onCheckedChange={() => toggleWidget(w.key)}
                  aria-label={`Show ${w.label} widget`}
                />
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
