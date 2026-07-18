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
