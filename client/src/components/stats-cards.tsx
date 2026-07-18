import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { ProgressOverview } from "@shared/schema";
import { AnimatedNumber } from "@/components/animated-number";

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4">
      <p className="font-display text-2xl">{children}</p>
      <p className="pt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function StripTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { date: string; done: number; scheduled: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const [, m, day] = d.date.split("-");
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg">
      <span className="text-muted-foreground">
        {Number(day)}/{Number(m)}:
      </span>{" "}
      <span className="font-medium tabular-nums">
        {d.done} of {d.scheduled} done
      </span>
    </div>
  );
}

/**
 * Progress overview: three stat tiles + a 30-day completion strip.
 * Single series — the title names it, no legend. Bars wear one mark color;
 * all text stays in ink tokens.
 */
export function StatsCards({ overview }: { overview: ProgressOverview }) {
  const max = Math.max(1, ...overview.last30.map((d) => d.done));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="best streak">
          <AnimatedNumber value={overview.bestStreak} />
        </Tile>
        <Tile label="30-day rate">
          <span className="tabular-nums">{overview.rate30d}%</span>
        </Tile>
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 pb-2 pt-4">
        <p className="pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Completions — last 30 days
        </p>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview.last30} barCategoryGap={2} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" hide />
              <Tooltip content={<StripTooltip />} cursor={{ fill: "hsl(40 30% 88% / 0.06)" }} />
              <Bar dataKey="done" radius={[2, 2, 0, 0]} minPointSize={2} isAnimationActive={false}>
                {overview.last30.map((d) => (
                  <Cell
                    key={d.date}
                    fill={
                      d.done === 0
                        ? "hsl(40 30% 88% / 0.10)"
                        : `hsl(40 30% 88% / ${0.35 + 0.65 * (d.done / max)})`
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
