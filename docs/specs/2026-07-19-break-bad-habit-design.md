# Break a Bad Habit — Design (approved 2026-07-19)

Mirror Atoms' "break a bad habit" type. User-approved decisions:

- **Type picker:** tapping "+ Habits" first shows a chooser — two big cards,
  "Build a habit" / "Break a bad habit". Build → existing wizard unchanged.
- **Break wizard (3 steps):**
  1. Define — title only, shown verbatim on the card ("No vaping").
     No action, no tiny version, no time. Shuffle uses break presets.
  2. Days — days-of-week picker only (default every day). No time row.
  3. Identity + color — identity sentence + greyish palette (3 muted tones,
     only for break habits; normal palette hidden here).
- **Card wording:** title exactly as typed (user chose this over "No [title]"
  or "Avoid [title]" prefixes).
- **Hold = "I avoided it today."** Same 2s hold / pulse / pop / burst
  (grey-tinted) / chime. Streaks, don't-miss-twice, milestones, backfill,
  skip: identical to build habits.
- **Edit:** break habit reopens break variant directly, no chooser.
- **Focus tab:** break habits excluded from the focus-session habit picker.
- **No reminders step** for break habits.

## Data model (approach A — approved)

`habits.kind` text NOT NULL default `'build'`, values `'build' | 'break'`.
Break rows: `action` = title (satisfies not-null, keeps detail sane),
`time` and `tinyVersion` null. Everything downstream (completions, streaks,
progress) untouched — a break habit IS a habit.

Rejected: separate table (duplicates streak/completion machinery), sentinel
encoding via empty action (fragile, invisible).

## Rollout order

Local `.env` points at the LIVE Neon DB → `npm run db:push` first (additive
column, old rows default to build) → owner reviews on localhost:5000 →
git push → Render autodeploy. Nothing pushed to GitHub until owner approves
what they see locally.
