# Quarks

A personal habit tracker inspired by the interaction design of the Atoms app:
identity-based habits ("I will _ at _ in _, so I can become the type of person
that _"), big hold-to-complete habit cards with a burst celebration,
"don't miss twice" streaks, habit stacking, and focus sessions. Warm eggshell
theme with an ink dark mode. Built for personal use only; all assets and copy
are original.

## What's inside

- **Today** — squircle habit cards (hold to complete: fill, pop, burst,
  chime + vibration), 5-day date strip with tap-to-backfill, Compact View,
  pause/resume; the three-dot button (top-left) opens Settings
- **Focus** — pick a habit + minutes, calm countdown ring (drift-proof),
  finishing can log the habit automatically
- **Progress** — total repetitions ("votes"), best streak, 30-day rate +
  strip, per-habit month calendar with last-7-days editing
- **Settings** (in the three-dot menu) — light/dark/auto theme, sound +
  vibration toggles, reminders (ring while the app is open), JSON export
- Milestones at 7/14/30/60/100/180/365-day streaks. A streak is consecutive
  scheduled days — missing one ends it and starts a fresh run (your best run
  is kept). "Don't miss twice" is the nudge shown after a single miss, not an
  amnesty. Skips are excused and never break a streak.

## Run it

```
npm install
npm run dev        # http://localhost:5000  (or double-click "Start Quarks.bat")
```

- `npm run check` — TypeScript check
- `npm test` — streak engine + sentence grammar suites
- `npm run build` / `npm start` — production build / run
- `npm run db:push` — push schema to Neon (load DATABASE_URL into the shell
  first; drizzle-kit doesn't read .env)

## How data is stored

Without `DATABASE_URL`, everything lives in a local `quarks.json` file.
With it (in `.env`), data lives in Neon Postgres — the same database the
deployed app uses, so the PC and phone stay in sync.

## Deploying

Push to `main` → Render auto-deploys via `render.yaml` (health check:
`/healthz`). Secrets (`DATABASE_URL`, `APP_PASSWORD`) are set in the Render
dashboard, never in git. The whole app sits behind one shared password when
`APP_PASSWORD` is set; the gate stays off for local dev.
