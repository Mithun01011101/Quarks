/**
 * The implementation-intention sentence every habit is built around.
 * Build: "I will [action] at [time] in the [location], so I can become the
 * type of person who [identity]."
 * Break: "[title], [days], so I can become the type of person who [identity]."
 */
import type { HabitKind } from "@shared/schema";

export function formatTime12(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return mStr === "00" ? `${hour12} ${suffix}` : `${hour12}:${mStr} ${suffix}`;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "every day" or "on Mon, Wed, Fri" — never an empty string. */
export function daysPhrase(scheduleDays?: string | null): string {
  const days = scheduleDays?.trim();
  if (!days || days.length === 7) return "every day";
  return "on " + days.split("").map((d) => DAY_SHORT[Number(d)]).join(", ");
}

/**
 * Fragments typed into the wizard land mid-sentence ("I will Read 1 chapter"),
 * so drop a leading capital. ALL-CAPS stays — it's deliberate ("NOF", "GYM").
 */
export function midSentence(text: string): string {
  const s = text.trim();
  const first = s.split(/\s+/)[0] ?? "";
  if (first && /[A-Z]/.test(first) && first === first.toUpperCase()) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

const AT_PLACES = new Set(["home", "work", "school", "church", "uni", "university"]);
const ON_PLACES = new Set(["couch", "sofa", "bed", "porch", "balcony", "mat", "treadmill"]);

/**
 * Places need the right preposition and article: "in the kitchen", "at work",
 * "on the couch", "outside" — not "in kitchen" / "in couch" / "in outside".
 */
export function placeParts(location?: string | null): { prep: string; place: string } | null {
  const raw = location?.trim();
  if (!raw) return null;
  const l = raw.toLowerCase();
  if (l === "outside" || l === "anywhere") return { prep: "", place: l };
  if (AT_PLACES.has(l)) return { prep: "at", place: l };
  if (ON_PLACES.has(l)) return { prep: "on", place: `the ${l}` };
  // Already carries its own article/possessive ("my desk", "the gym").
  if (/^(the|my|our|a|an)\s/.test(l)) return { prep: "in", place: l };
  return { prep: "in", place: `the ${l}` };
}

/**
 * `identity` is stored as a VERB phrase ("reads every day"), so it can never be
 * rendered bare — it always needs this lead-in, or you get "I want to become
 * reads every day". Every surface imports this constant instead of retyping it.
 */
export const IDENTITY_PREFIX = "the type of person who";

/** The identity clause — the wizard collects a verb phrase ("reads every day"). */
export function identityClause(identity: string): string {
  return `${IDENTITY_PREFIX} ${midSentence(identity)}`;
}

/**
 * Per-kind wording for the habit card. Keyed by HabitKind, so adding a kind to
 * HABIT_KINDS fails to compile until its copy is written here.
 */
export const KIND_COPY: Record<HabitKind, { cardIntro: string; holdLabel: string }> = {
  build: {
    cardIntro: `I want to become ${IDENTITY_PREFIX}`,
    holdLabel: "hold to complete",
  },
  break: {
    cardIntro: `I want to become ${IDENTITY_PREFIX}`,
    holdLabel: "hold to mark avoided today",
  },
};

/** Runtime-safe lookup — a row written by an older build falls back to "build". */
export function kindCopy(kind?: HabitKind | null): (typeof KIND_COPY)[HabitKind] {
  return (kind && KIND_COPY[kind]) || KIND_COPY.build;
}

export function habitSentence(h: {
  kind?: HabitKind | null;
  name?: string;
  action: string;
  tinyVersion?: string | null;
  time?: string | null;
  location?: string | null;
  scheduleDays?: string | null;
  identity: string;
}): string {
  const becoming = `so I can become ${identityClause(h.identity)}`;
  const kind: HabitKind = h.kind ?? "build";

  // Switch (not if/else) on purpose: the `never` default means a new HabitKind
  // is a compile error here rather than silently falling through to the build
  // template — that fallthrough is what produced "I will NOF at any time".
  switch (kind) {
    case "break": {
      // The title is whatever the user typed ("No vaping", "NOF"), so it stands
      // on its own — gluing a verb in front of it makes nonsense.
      const what = (h.name?.trim() || h.action).trim();
      return `${what}, ${daysPhrase(h.scheduleDays)}, ${becoming}.`;
    }
    case "build": {
      const what = midSentence(h.tinyVersion?.trim() || h.action);
      const when = h.time ? `at ${formatTime12(h.time)}` : "at any time";
      const parts = placeParts(h.location);
      const where = parts ? (parts.prep ? ` ${parts.prep} ${parts.place}` : ` ${parts.place}`) : "";
      return `I will ${what} ${when}${where}, ${becoming}.`;
    }
    default: {
      const unhandled: never = kind;
      throw new Error(`No sentence written for habit kind: ${String(unhandled)}`);
    }
  }
}
