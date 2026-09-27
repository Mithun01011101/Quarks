/**
 * Grammar checks for the generated habit sentences.
 * Run: npx tsx scripts/check-sentences.ts   (exits 1 on any failure)
 *
 * These exist because three separate wordings shipped broken:
 *   "I want to become reads every day"  (identity rendered bare)
 *   "I will NOF at any time"            (verb glued onto a break-habit title)
 *   "I will Read 1 chapter in couch"    (stray capital, missing preposition)
 * The invariants below fail on all three, for every habit kind.
 */
import { HABIT_KINDS, type HabitKind } from "../shared/schema";
import {
  IDENTITY_PREFIX,
  cueLabel,
  daysShort,
  habitSentence,
  identityClause,
  kindCopy,
  midSentence,
  placeParts,
  streakLabel,
} from "../client/src/lib/sentence";
import { LOCATION_SUGGESTIONS } from "../client/src/lib/presets";

let failures = 0;

function expect(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}\n      expected ${e}\n      got      ${a}`);
  }
}

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

const base = {
  name: "Read",
  action: "read one page",
  tinyVersion: null,
  time: null,
  location: null,
  scheduleDays: "0123456",
  identity: "reads every day",
};

// ---- build sentences ----
expect(
  "build: bare habit",
  habitSentence({ ...base, kind: "build" }),
  "I will read one page at any time, so I can become the type of person who reads every day.",
);
expect(
  "build: tiny version wins over action",
  habitSentence({ ...base, kind: "build", tinyVersion: "read one paragraph" }),
  "I will read one paragraph at any time, so I can become the type of person who reads every day.",
);
expect(
  "build: time is 12h",
  habitSentence({ ...base, kind: "build", time: "22:00" }),
  "I will read one page at 10 pm, so I can become the type of person who reads every day.",
);
expect(
  "build: typed capital drops mid-sentence",
  habitSentence({ ...base, kind: "build", action: "Read 1 chapter" }),
  "I will read 1 chapter at any time, so I can become the type of person who reads every day.",
);
expect(
  "build: ALL-CAPS survives",
  habitSentence({ ...base, kind: "build", action: "GYM for 20 minutes" }),
  "I will GYM for 20 minutes at any time, so I can become the type of person who reads every day.",
);

// ---- places: preposition + article ----
expect("place: plain noun takes 'in the'", placeParts("Kitchen"), { prep: "in", place: "the kitchen" });
expect("place: furniture takes 'on the'", placeParts("Couch"), { prep: "on", place: "the couch" });
expect("place: institution takes 'at'", placeParts("Work"), { prep: "at", place: "work" });
expect("place: a desk takes 'at the' (not 'in the desk')", placeParts("Desk"), { prep: "at", place: "the desk" });
expect("place: the gym takes 'at the'", placeParts("Gym"), { prep: "at", place: "the gym" });
for (const chip of LOCATION_SUGGESTIONS) {
  const parts = placeParts(chip);
  const phrase = parts ? `${parts.prep} ${parts.place}`.trim() : "";
  check(`place chip "${chip}" reads as a phrase`, phrase.length > 0 && !/\bin the (desk|gym|table)\b/.test(phrase), phrase);
}
expect("place: 'outside' takes no preposition", placeParts("Outside"), { prep: "", place: "outside" });
expect("place: existing article kept", placeParts("my desk"), { prep: "in", place: "my desk" });
expect("place: empty is null", placeParts("   "), null);
expect(
  "build: place reads naturally",
  habitSentence({ ...base, kind: "build", location: "Couch" }),
  "I will read one page at any time on the couch, so I can become the type of person who reads every day.",
);

// ---- break sentences: title stands alone, never "I will <title>" ----
expect(
  "break: title verbatim, no verb glued on",
  habitSentence({ ...base, kind: "break", name: "NOF", action: "NOF", identity: "doesn't need it" }),
  "NOF, every day, so I can become the type of person who doesn't need it.",
);
expect(
  "break: subset of days",
  habitSentence({
    ...base,
    kind: "break",
    name: "No takeaway",
    action: "No takeaway",
    scheduleDays: "12345",
    identity: "cooks at home",
  }),
  "No takeaway, on Mon, Tue, Wed, Thu, Fri, so I can become the type of person who cooks at home.",
);

// ---- short labels for compact rows ----
expect("days: all seven", daysShort("0123456"), "Every day");
expect("days: empty means every day (schema default)", daysShort(""), "Every day");
expect("days: weekdays collapse to a range", daysShort("12345"), "Mon–Fri");
expect("days: weekend stays together, Sat first", daysShort("06"), "Sat, Sun");
expect("days: scattered days listed", daysShort("135"), "Mon, Wed, Fri");
expect("days: range plus a stray day", daysShort("01234"), "Mon–Thu, Sun");
expect("streak: counts days", streakLabel(12), "12-day streak");
expect("streak: a single day", streakLabel(1), "1-day streak");
expect("streak: none running", streakLabel(0), "no current streak");
expect("cue: time and place", cueLabel({ kind: "build", time: "21:00", location: "bed" }), "9 pm · on the bed");
expect("cue: any time, no place", cueLabel({ kind: "build", time: null, location: null }), "Any time");
expect("cue: place without preposition", cueLabel({ kind: "build", time: "07:30", location: "Outside" }), "7:30 am · outside");
expect("cue: break habit shows its days", cueLabel({ kind: "break", scheduleDays: "12345" }), "Mon–Fri");
for (const kind of HABIT_KINDS satisfies readonly HabitKind[]) {
  const cue = cueLabel({ kind, time: "08:00", location: "Kitchen", scheduleDays: "0123456" });
  check(`${kind}: cue label starts with a capital or digit`, /^[A-Z0-9]/.test(cue), cue);
  check(`${kind}: cue label has no double spaces`, !cue.includes("  "), cue);
}

// ---- helpers ----
expect("identity clause always leads in", identityClause("reads every day"), `${IDENTITY_PREFIX} reads every day`);
expect("midSentence lowercases a typed capital", midSentence("Read a page"), "read a page");
expect("midSentence leaves ALL-CAPS", midSentence("NOF now"), "NOF now");

// ---- invariants that must hold for EVERY kind, present and future ----
for (const kind of HABIT_KINDS satisfies readonly HabitKind[]) {
  const s = habitSentence({
    ...base,
    kind,
    name: "NOF",
    action: "NOF",
    location: "Couch",
    identity: "keeps promises",
  });
  check(`${kind}: ends in a full stop`, s.endsWith("."), s);
  check(`${kind}: starts with a capital`, /^[A-Z]/.test(s), s);
  check(`${kind}: identity never rendered bare`, s.includes(IDENTITY_PREFIX), s);
  check(`${kind}: says "person who", not "person that"`, !s.includes("person that"), s);
  check(`${kind}: no double spaces`, !s.includes("  "), s);
  check(`${kind}: no space before comma`, !s.includes(" ,"), s);
  check(`${kind}: no bare "in couch"`, !/\bin couch\b/.test(s), s);

  const copy = kindCopy(kind);
  check(`${kind}: card intro leads into the identity`, copy.cardIntro.endsWith(IDENTITY_PREFIX), copy.cardIntro);
  check(`${kind}: hold label written`, copy.holdLabel.length > 0, copy.holdLabel);
}

// A row saved by an older build (or a bad value) must not crash the card.
expect("unknown kind falls back to build copy", kindCopy(undefined as unknown as HabitKind).holdLabel, "hold to complete");

if (failures > 0) {
  console.error(`\n${failures} sentence check(s) failed.`);
  process.exit(1);
}
console.log("\nAll sentence checks passed.");
