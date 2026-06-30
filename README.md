# 🀄 Lottie Mahjong — Hand Tracker

A little web app to track the American Mahjong (NMJL) hands you've **played**
and **won**, with color-coded hands, point values, and the instructions printed
beside each line. Log every win to build up your stats over time.

Built with **Next.js + Tailwind CSS + Framer Motion**, with data stored in
**Supabase**.

## Features (Phase 1 — scaffold)

- Browse all hands, grouped by their section / "line" on the card.
- Color-coded patterns matching the printed card ink (green / red / blue).
- Point value + Concealed (C) / Exposed (X) badge per hand.
- Filter to show **All**, **Played**, or **Not played** hands.
- One-tap **Log win** with live stats (hands played, total wins, % complete).
- Saves to Supabase (syncs across devices); falls back to on-device storage
  if no database is configured.
- Animated UI with Framer Motion.

> **Note:** The hands in `src/data/hands.ts` are placeholders so the UI renders.
> Replace them with your real card — see below.

## Getting started

```bash
npm install
npm run dev
# open http://localhost:3000
```

Environment variables (already set in `.env.local` for local dev):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Copy `.env.example` to `.env.local` if you need to recreate it. These are
publishable (anon) values and are safe in a client app; Row Level Security on
the database controls access.

## Adding your real hands

Edit `src/data/hands.ts`. Each section has hands shaped like:

```ts
{
  id: "2025-1",            // unique, stable id (used to record wins)
  sectionId: "2025",
  pattern: [
    { text: "FF",   color: "green" },
    { text: "2025", color: "red" },
  ],
  points: 25,
  concealed: false,        // true = C, false = X
  description: "The little instruction printed beside the hand.",
}
```

Use `color` values `green`, `red`, `blue`, or `neutral` to match the card ink.
Keep `id` stable once a hand has wins logged against it, so history is preserved.

## Data model

A single table, `public.mahjong_wins`:

| column   | type        | notes                          |
| -------- | ----------- | ------------------------------ |
| id       | uuid        | primary key                    |
| hand_id  | text        | matches a hand `id` in code    |
| won_at   | timestamptz | defaults to now()              |
| note     | text        | optional                       |

A hand counts as "played" when it has at least one win. The SQL lives in
`supabase/migrations/0001_mahjong_create_wins.sql`.

## Deploying

This app is a **static export** (`output: "export"`), so it deploys as plain
files — no Node server required.

```bash
npm run build   # outputs to ./out
```

Then point a static host at `./out`:

- **Cloudflare Pages** — framework preset "Next.js (Static HTML Export)",
  build command `npm run build`, output dir `out`.
- **Render** — create a **Static Site**, build command `npm run build`,
  publish directory `out`.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as
environment variables in the host's dashboard.

## Roadmap

- [ ] Phase 2: Drop in the real hands from the card photos.
- [ ] Phase 3: Richer stats (wins over time, most-played, charts).
- [ ] Phase 4: Polish — more motion, per-hand notes, search.
- [ ] Phase 5: Deploy to Cloudflare Pages / Render.
