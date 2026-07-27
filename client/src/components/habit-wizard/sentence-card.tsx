import { RefreshCw } from "lucide-react";
import type { HabitKind } from "@shared/schema";
import { daysPhrase, formatTime12, IDENTITY_PREFIX, midSentence, placeParts } from "@/lib/sentence";
import { quarkHsl } from "@/lib/colors";
import { cn } from "@/lib/utils";

function NumChip({ n }: { n: string }) {
  return (
    <span
      className="bolt-badge mx-0.5 inline-flex h-5 w-6 -translate-y-px items-center justify-center rounded-md align-middle text-[10px] font-bold text-white"
      aria-hidden
    >
      {n}
    </span>
  );
}

function Slot({ value, placeholder }: { value: string | null; placeholder: string }) {
  if (value) {
    return (
      <span className="font-medium text-foreground underline decoration-q-ember/60 decoration-2 underline-offset-4">
        {value}
      </span>
    );
  }
  return (
    <span className="border-b-2 border-dotted border-muted-foreground/50 px-0.5 text-muted-foreground">
      {placeholder}
    </span>
  );
}

/**
 * The sticky implementation-intention card. It stays visible across wizard
 * steps so the sentence visibly assembles as each numbered answer lands.
 */
export function SentenceCard({
  name,
  kind,
  action,
  tinyVersion,
  anytime,
  time,
  location,
  scheduleDays,
  identity,
  color,
  onShuffle,
}: {
  name: string;
  kind: HabitKind;
  action: string;
  tinyVersion: string;
  anytime: boolean;
  time: string;
  location: string;
  scheduleDays: string;
  identity: string;
  color: string;
  onShuffle?: () => void;
}) {
  const typed = tinyVersion.trim() || action.trim();
  const what = typed ? midSentence(typed) : null;
  const when = anytime ? "any time" : time ? formatTime12(time) : null;
  const where = placeParts(location);

  return (
    <div
      className={cn("rounded-2xl border bg-card px-4 pb-3 pt-4 shadow-sm")}
      style={{ borderColor: quarkHsl(color, 0.45) }}
    >
      {kind === "break" ? (
        <p className="font-display text-[17px] leading-[1.9] text-foreground/90">
          <NumChip n="01" /> <Slot value={name.trim() || null} placeholder="the habit to break" />,{" "}
          <NumChip n="02" /> <Slot value={daysPhrase(scheduleDays)} placeholder="every day" />, so I
          can become {IDENTITY_PREFIX} <NumChip n="03" />{" "}
          <Slot value={identity.trim() ? midSentence(identity) : null} placeholder="…" />.
        </p>
      ) : (
      <p className="font-display text-[17px] leading-[1.9] text-foreground/90">
        I will <NumChip n="01" /> <Slot value={what} placeholder="do my habit" /> at{" "}
        <NumChip n="02" /> <Slot value={when} placeholder="a time" />
        {where ? (
          <>
            {where.prep ? ` ${where.prep} ` : " "}
            <Slot value={where.place} placeholder="a place" />
          </>
        ) : null}
        , so I can become {IDENTITY_PREFIX} <NumChip n="03" />{" "}
        <Slot value={identity.trim() ? midSentence(identity) : null} placeholder="…" />.
      </p>
      )}
      {onShuffle && (
        <div className="flex justify-center pt-2.5">
          <button
            type="button"
            onClick={onShuffle}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RefreshCw size={12} /> Different example
          </button>
        </div>
      )}
    </div>
  );
}
