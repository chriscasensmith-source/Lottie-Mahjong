import type { GameRecord, Round, Tracked } from "@/lib/types";
import {
  GAMES_PER_ROUND,
  gameBlanks,
  gameCardYear,
  gameJokerless,
  gamePoints,
  gameSelfDrawn,
  handById,
  localDayKey,
  sectionOf,
} from "@/lib/stats";

// A personal CSV backup of every game. One row per game; round details are
// repeated on each of its games so the file stands on its own in a spreadsheet.
// Details that were never asked are written as "not recorded", never "no".

const COLUMNS = [
  "game_id",
  "date",
  "time",
  "timestamp_utc",
  "outcome",
  "card_year",
  "hand_id",
  "section",
  "hand",
  "hand_base_points",
  "points",
  "jokers",
  "win_type",
  "blanks",
  "round_id",
  "round_game_number",
  "round_games_logged",
  "round_status",
] as const;

function cell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function yesNo(v: Tracked, yes: string, no: string, na = ""): string {
  if (v === null) return na || "not recorded";
  return v ? yes : no;
}

export function gamesToCsv(records: GameRecord[], rounds: Round[]): string {
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const byRound = new Map<string, GameRecord[]>();
  for (const g of records) {
    if (!g.round_id) continue;
    if (!byRound.has(g.round_id)) byRound.set(g.round_id, []);
    byRound.get(g.round_id)!.push(g);
  }
  for (const list of byRound.values()) list.sort((a, b) => (a.won_at < b.won_at ? -1 : 1));

  const rows = [...records]
    .sort((a, b) => (a.won_at < b.won_at ? -1 : 1))
    .map((g) => {
      const d = new Date(g.won_at);
      const hand = g.hand_id ? handById(g.hand_id) : undefined;
      const isWin = g.outcome === "win";
      const round = g.round_id ? roundById.get(g.round_id) : undefined;
      const roundGames = round ? (byRound.get(round.id) ?? []) : [];
      const status = !round
        ? ""
        : roundGames.length >= GAMES_PER_ROUND
          ? "complete"
          : round.closed_at
            ? "ended early"
            : "incomplete";
      return [
        g.id ?? "",
        localDayKey(d),
        d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        d.toISOString(),
        g.outcome,
        gameCardYear(g),
        g.hand_id ?? "",
        g.hand_id ? (sectionOf(g.hand_id)?.name ?? "") : "",
        hand ? hand.pattern.map((p) => p.text).join(" ") : "",
        hand ? hand.points : "",
        isWin ? gamePoints(g) : 0,
        isWin ? yesNo(gameJokerless(g), "no jokers", "jokers") : "",
        isWin ? yesNo(gameSelfDrawn(g), "self-drawn", "discard") : "",
        yesNo(gameBlanks(g, roundById), "blanks", "no blanks"),
        round ? round.id : "",
        round ? roundGames.indexOf(g) + 1 : "",
        round ? roundGames.length : "",
        status,
      ];
    });

  return [COLUMNS.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens it as UTF-8.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
