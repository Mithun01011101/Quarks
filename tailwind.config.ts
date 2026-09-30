import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  // Hover styles only on devices that really hover — no "stuck" hover tint
  // after a tap on a phone.
  future: { hoverOnlyWhenSupported: true },
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        charcoal: {
          DEFAULT: "hsl(var(--charcoal) / <alpha-value>)",
          foreground: "hsl(var(--charcoal-foreground) / <alpha-value>)",
        },
        "q-ember": "hsl(var(--q-ember) / <alpha-value>)",
        "q-gold": "hsl(var(--q-gold) / <alpha-value>)",
        "q-sage": "hsl(var(--q-sage) / <alpha-value>)",
        "q-teal": "hsl(var(--q-teal) / <alpha-value>)",
        "q-sky": "hsl(var(--q-sky) / <alpha-value>)",
        "q-iris": "hsl(var(--q-iris) / <alpha-value>)",
        "q-plum": "hsl(var(--q-plum) / <alpha-value>)",
        "q-rose": "hsl(var(--q-rose) / <alpha-value>)",
        "q-slate": "hsl(var(--q-slate) / <alpha-value>)",
        "q-stone": "hsl(var(--q-stone) / <alpha-value>)",
        "q-ash": "hsl(var(--q-ash) / <alpha-value>)",
        // "Don't miss twice" warning (text / chip fill / dashed outline)
        "q-amber": "hsl(var(--q-amber) / <alpha-value>)",
        "q-amber-soft": "hsl(var(--q-amber-soft) / <alpha-value>)",
        "q-amber-line": "hsl(var(--q-amber-line) / <alpha-value>)",
        // Uniform completed pebble
        "q-done": "hsl(var(--q-done) / <alpha-value>)",
        "q-done-border": "hsl(var(--q-done-border) / <alpha-value>)",
        // Unfinished pebble (to-do card / compact row)
        "q-todo": "hsl(var(--q-todo) / <alpha-value>)",
        // Deep end of the yellow badge gradient (underline accents)
        bolt: "hsl(var(--flame-b) / <alpha-value>)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
