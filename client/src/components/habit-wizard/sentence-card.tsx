import type { HabitKind } from "@shared/schema";
import { daysPhrase, formatTime12, IDENTITY_PREFIX, midSentence, placeParts } from "@/lib/sentence";
import { quarkHsl } from "@/lib/colors";
import { cn } from "@/lib/utils";

function Slot({ value, placeholder }: { value: string | null; placeholder: string }) {
  if (value) {
    return (
      <span className="underline decoration-bolt decoration-2 underline-offset-4">{value}</span>
    );
  }
  return (
    <span className="text-muted-foreground underline decoration-muted-foreground/60 decoration-dotted decoration-2 underline-offset-4">
      {placeholder}
    </span>
  );
}

/**
 * The live implementation-intention preview at the top of the wizard. It
 * assembles as each step lands, and shrinks to two lines while the keyboard
 * is up so the field being typed in stays visible.
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
  compact = false,
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
  compact?: boolean;
}) {
  const typed = tinyVersion.trim() || action.trim();
  const what = typed ? midSentence(typed) : null;
  const when = anytime ? "any time" : time ? formatTime12(time) : null;
  const where = placeParts(location);
  const who = identity.trim() ? midSentence(identity) : null;

  return (
    <p
      aria-label="Preview"
      className={cn(
        "rounded-2xl border px-3.5 py-2.5 font-display text-[15px] leading-[21px] text-foreground/90",
        compact && "py-2",
      )}
      style={{ borderColor: quarkHsl(color, 0.45) }}
    >
      {/* the clamp lives on an inner box so the padding can't show a third line */}
      <span className={cn("block", compact && "line-clamp-2")}>
        {kind === "break" ? (
          <>
            <Slot value={name.trim() || null} placeholder="the habit to break" />,{" "}
            <Slot value={daysPhrase(scheduleDays)} placeholder="every day" />, so I can become{" "}
            {IDENTITY_PREFIX} <Slot value={who} placeholder="…" />.
          </>
        ) : (
          <>
            I will <Slot value={what} placeholder="do my habit" /> at{" "}
            <Slot value={when} placeholder="a time" />
            {where ? (
              <>
                {where.prep ? ` ${where.prep} ` : " "}
                <Slot value={where.place} placeholder="a place" />
              </>
            ) : null}
            , so I can become {IDENTITY_PREFIX} <Slot value={who} placeholder="…" />.
          </>
        )}
      </span>
    </p>
  );
}
