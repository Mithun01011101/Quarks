import type { CSSProperties } from "react";

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
  /** Check mark / glyph color ON a solid disc of this color (higher contrast of ink vs white). */
  on: string;
};

const INK = "#1C1B17";
const WHITE = "#FFFFFF";

export const QUARK_COLORS: QuarkColor[] = [
  { key: "ember", label: "Ember", cssVar: "--q-ember", bg: "bg-q-ember", bgSoft: "bg-q-ember/15", text: "text-q-ember", border: "border-q-ember", ring: "ring-q-ember", on: INK },
  { key: "gold", label: "Gold", cssVar: "--q-gold", bg: "bg-q-gold", bgSoft: "bg-q-gold/15", text: "text-q-gold", border: "border-q-gold", ring: "ring-q-gold", on: INK },
  { key: "sage", label: "Sage", cssVar: "--q-sage", bg: "bg-q-sage", bgSoft: "bg-q-sage/15", text: "text-q-sage", border: "border-q-sage", ring: "ring-q-sage", on: INK },
  { key: "teal", label: "Teal", cssVar: "--q-teal", bg: "bg-q-teal", bgSoft: "bg-q-teal/15", text: "text-q-teal", border: "border-q-teal", ring: "ring-q-teal", on: INK },
  { key: "sky", label: "Sky", cssVar: "--q-sky", bg: "bg-q-sky", bgSoft: "bg-q-sky/15", text: "text-q-sky", border: "border-q-sky", ring: "ring-q-sky", on: INK },
  { key: "iris", label: "Iris", cssVar: "--q-iris", bg: "bg-q-iris", bgSoft: "bg-q-iris/15", text: "text-q-iris", border: "border-q-iris", ring: "ring-q-iris", on: WHITE },
  { key: "plum", label: "Plum", cssVar: "--q-plum", bg: "bg-q-plum", bgSoft: "bg-q-plum/15", text: "text-q-plum", border: "border-q-plum", ring: "ring-q-plum", on: INK },
  { key: "rose", label: "Rose", cssVar: "--q-rose", bg: "bg-q-rose", bgSoft: "bg-q-rose/15", text: "text-q-rose", border: "border-q-rose", ring: "ring-q-rose", on: INK },
];

/** Muted tones offered ONLY for break-a-bad-habit cards. */
export const BREAK_COLORS: QuarkColor[] = [
  { key: "slate", label: "Slate", cssVar: "--q-slate", bg: "bg-q-slate", bgSoft: "bg-q-slate/15", text: "text-q-slate", border: "border-q-slate", ring: "ring-q-slate", on: WHITE },
  { key: "stone", label: "Stone", cssVar: "--q-stone", bg: "bg-q-stone", bgSoft: "bg-q-stone/15", text: "text-q-stone", border: "border-q-stone", ring: "ring-q-stone", on: WHITE },
  { key: "ash", label: "Ash", cssVar: "--q-ash", bg: "bg-q-ash", bgSoft: "bg-q-ash/15", text: "text-q-ash", border: "border-q-ash", ring: "ring-q-ash", on: INK },
];

const byKey = new Map([...QUARK_COLORS, ...BREAK_COLORS].map((c) => [c.key, c]));

export function quarkColor(key: string): QuarkColor {
  return byKey.get(key) ?? QUARK_COLORS[0];
}

/** Inline color value for places classes can't reach (SVG, box-shadow). */
export function quarkHsl(key: string, alpha = 1): string {
  const c = quarkColor(key);
  return alpha >= 1 ? `hsl(var(${c.cssVar}))` : `hsl(var(${c.cssVar}) / ${alpha})`;
}

/** Style that feeds a habit color to the `.q-ink` utility (legible icon color). */
export function quarkInkVar(key: string): CSSProperties {
  return { ["--q-c" as string]: `var(${quarkColor(key).cssVar})` } as CSSProperties;
}
