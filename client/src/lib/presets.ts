/**
 * Original preset copy for the creation wizard — starting points the user can
 * pick and reshape. Every string here is Quarks' own.
 */
export type HabitPreset = {
  name: string;
  action: string;
  tiny: string;
  identity: string;
  icon: string;
};

export const HABIT_PRESETS: HabitPreset[] = [
  { name: "Read", action: "read one page", tiny: "read one paragraph", identity: "reads every day", icon: "BookOpen" },
  { name: "Meditate", action: "meditate for two minutes", tiny: "take three slow breaths", identity: "stays calm under pressure", icon: "Wind" },
  { name: "Run", action: "put on my running shoes", tiny: "lay out my running clothes", identity: "never misses a run", icon: "Footprints" },
  { name: "Write", action: "write one sentence", tiny: "open my notebook", identity: "writes daily", icon: "PenLine" },
  { name: "Hydrate", action: "drink a glass of water", tiny: "pour a glass of water", identity: "takes care of their body", icon: "GlassWater" },
  { name: "Train", action: "do five push-ups", tiny: "do one push-up", identity: "shows up for training", icon: "Dumbbell" },
  { name: "Tidy", action: "clear one surface", tiny: "put away one thing", identity: "keeps a clear space", icon: "Sparkles" },
  { name: "Walk", action: "step outside for fresh air", tiny: "open the front door", identity: "moves every day", icon: "TreePine" },
];

/** Starting points for break-a-bad-habit: title shown verbatim + identity. */
export type BreakPreset = {
  name: string;
  identity: string;
  icon: string;
};

export const BREAK_PRESETS: BreakPreset[] = [
  { name: "No doomscrolling", identity: "puts the phone down", icon: "Phone" },
  { name: "No snoozing the alarm", identity: "gets up on the first ring", icon: "Bed" },
  { name: "No sugary drinks", identity: "drinks water first", icon: "GlassWater" },
  { name: "No late-night snacking", identity: "lets the kitchen close at night", icon: "Moon" },
  { name: "No impulse buys", identity: "sleeps on every purchase", icon: "Banknote" },
  { name: "No skipping breakfast", identity: "starts the day fueled", icon: "Coffee" },
];

export const BREAK_IDENTITY_SUGGESTIONS = [
  "puts the phone down",
  "gets up on the first ring",
  "drinks water first",
  "doesn't need the habit anymore",
  "chooses the harder right thing",
  "keeps promises to themselves",
];

export const IDENTITY_SUGGESTIONS = [
  "reads every day",
  "stays calm under pressure",
  "never misses a workout",
  "writes daily",
  "takes care of their body",
  "keeps a clear space",
  "learns something new every day",
  "finishes what they start",
];

export const LOCATION_SUGGESTIONS = ["Kitchen", "Desk", "Bedroom", "Gym", "Outside", "Couch"];

/** Curated lucide icon names offered in the wizard's style step. */
export const WIZARD_ICONS = [
  "BookOpen", "Wind", "Footprints", "PenLine", "GlassWater", "Dumbbell",
  "Sparkles", "TreePine", "Coffee", "Moon", "Sun", "Music",
  "Brush", "Salad", "Bike", "Laptop", "Heart", "Camera",
  "Guitar", "Languages", "Banknote", "Bed", "Smile", "Phone",
] as const;
