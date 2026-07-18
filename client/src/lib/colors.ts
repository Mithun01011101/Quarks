/**
 * The 8 Quarks habit colors. Tailwind can't build class names dynamically,
 * so every class string is enumerated here in full.
 */
export type QuarkColor = {
  key: string;
  label: string;
  cssVar: string; // bare HSL triple variable, e.g. "--q-ember"
  bg: string;
  bgSoft: string; // dimmed fill for unfilled circle tints
  text: string;
  border: string;
  ring: string;
};

export const QUARK_COLORS: QuarkColor[] = [
  { key: "ember", label: "Ember", cssVar: "--q-ember", bg: "bg-q-ember", bgSoft: "bg-q-ember/15", text: "text-q-ember", border: "border-q-ember", ring: "ring-q-ember" },
  { key: "gold", label: "Gold", cssVar: "--q-gold", bg: "bg-q-gold", bgSoft: "bg-q-gold/15", text: "text-q-gold", border: "border-q-gold", ring: "ring-q-gold" },
  { key: "sage", label: "Sage", cssVar: "--q-sage", bg: "bg-q-sage", bgSoft: "bg-q-sage/15", text: "text-q-sage", border: "border-q-sage", ring: "ring-q-sage" },
  { key: "teal", label: "Teal", cssVar: "--q-teal", bg: "bg-q-teal", bgSoft: "bg-q-teal/15", text: "text-q-teal", border: "border-q-teal", ring: "ring-q-teal" },
  { key: "sky", label: "Sky", cssVar: "--q-sky", bg: "bg-q-sky", bgSoft: "bg-q-sky/15", text: "text-q-sky", border: "border-q-sky", ring: "ring-q-sky" },
  { key: "iris", label: "Iris", cssVar: "--q-iris", bg: "bg-q-iris", bgSoft: "bg-q-iris/15", text: "text-q-iris", border: "border-q-iris", ring: "ring-q-iris" },
  { key: "plum", label: "Plum", cssVar: "--q-plum", bg: "bg-q-plum", bgSoft: "bg-q-plum/15", text: "text-q-plum", border: "border-q-plum", ring: "ring-q-plum" },
  { key: "rose", label: "Rose", cssVar: "--q-rose", bg: "bg-q-rose", bgSoft: "bg-q-rose/15", text: "text-q-rose", border: "border-q-rose", ring: "ring-q-rose" },
];

const byKey = new Map(QUARK_COLORS.map((c) => [c.key, c]));

export function quarkColor(key: string): QuarkColor {
  return byKey.get(key) ?? QUARK_COLORS[0];
}

/** Inline color value for places classes can't reach (SVG, box-shadow). */
export function quarkHsl(key: string, alpha = 1): string {
  const c = quarkColor(key);
  return alpha >= 1 ? `hsl(var(${c.cssVar}))` : `hsl(var(${c.cssVar}) / ${alpha})`;
}
