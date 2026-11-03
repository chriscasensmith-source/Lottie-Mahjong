# 🀄 The Mahj Journal

A journal for your American Mahjong (NMJL) games: the full card with
color-coded hands, point values, and instructions; **rounds of 4 games**
(with a blanks / no blanks setting); wins logged with **jokers / no jokers**
and **self-drawn**, plus losses and wall games; a calendar of the days you
played; and stats.

**Scoring** follows NMJL doubling: no jokers ×2 (except Singles & Pairs, which
are always jokerless), self-drawn ×2.

**Database:** apply the SQL files in `supabase/migrations/` in order
(`0001` → `0005`) in the Supabase SQL editor.

**Tests:** `npm test` runs the stats and round-rule tests (Node's built-in runner, no extra packages).

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

Two tables (migrations `0001`–`0005` in `supabase/migrations/`, all applied):

**`mahjong_wins`**: one row per game (the name is historical).

| column           | notes                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| id               | uuid, made on the device so retries and Undo hit the exact row         |
| hand_id          | the hand for wins; null for losses and wall games                      |
| outcome          | `win`, `loss` or `wall`                                                |
| won_at           | when the game was played                                               |
| round_id         | the round it belongs to; null for single games and all older games     |
| jokerless, self_drawn, blanks | only meaningful when `details_recorded` is true           |
| details_recorded | false for games logged before Nov 3, 2026 (those details were never asked) |
| card_year        | the NMJL card used (2026)                                              |

**`mahjong_rounds`**: `id`, `started_at`, `blanks`, `closed_at` (set when a round
is ended early). A database trigger stops any round from holding more than 4 games.

## How the stats are defined

All of these live in `src/lib/stats.ts` and are covered by `npm test`.

| Metric | Definition |
| --- | --- |
| Total games | wins + losses + wall games |
| Overall win rate | wins ÷ total games |
| Decisive-game win rate | wins ÷ (wins + losses) |
| Wall-game rate | wall games ÷ total games |
| Recent decisive win rate | wins among the latest 50 decided games ÷ that sample (or fewer, labeled) |
| Unique hands won | distinct hands on the card with at least one win |
| Card / section completion | unique hands won ÷ hands on the card / in the section |
| Section wins | every win on a hand in that section, repeats included |
| Completed round | a tracked round with exactly 4 games |
| Avg wins per completed round | wins in completed rounds ÷ completed rounds |
| Hand points | sum of winning-hand values with NMJL doubling; older wins count at base value |

Rates show "—" when there's nothing to divide by. Self-drawn, no-joker and blanks
percentages only count games where the question was actually asked.

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
