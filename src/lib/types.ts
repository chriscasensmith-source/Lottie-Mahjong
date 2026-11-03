// Core domain types for the Mahjong hand tracker.

// The ink colors used to print hands on the American (NMJL) Mahjong card.
// Each segment of a hand can be a different color.
export type TileColor = "green" | "red" | "blue" | "neutral";

// One color-coded chunk of a hand's pattern, e.g. "FF" in green or "2025" in red.
export interface TileGroup {
  text: string;
  color: TileColor;
}

export interface Hand {
  id: string;
  // The section / "line" of the card this hand belongs to (e.g. "2025", "2468").
  sectionId: string;
  // The color-coded pattern, left to right.
  pattern: TileGroup[];
  // Point value of the hand (25, 30, 35, ...).
  points: number;
  // true = Concealed ("C"), false = Exposed ("X").
  concealed: boolean;
  // The little instruction / note printed beside the hand.
  description: string;
}

export interface Section {
  id: string;
  name: string;
  // A short subtitle/instruction shown under the section title.
  note?: string;
  // Tailwind text-color class used as the section accent.
  accentClass: string;
  hands: Hand[];
}

// The result of a single game.
export type GameOutcome = "win" | "loss" | "wall";

// A single logged game, as stored in Supabase (or localStorage fallback).
// Wins reference the hand that was made; losses and walls have no hand.
export interface GameRecord {
  id?: string; // uuid from Supabase, or a temporary client id when offline
  hand_id: string | null;
  outcome: GameOutcome;
  won_at: string; // ISO timestamp of the game
  round_id?: string | null; // the round this game belongs to (null = single game)
  blanks?: boolean; // single games only — round games use the round's setting
  jokerless?: boolean; // won without jokers ("No jokers")
  self_drawn?: boolean; // drew your own Mahjong tile
  // Were jokers / self-drawn / blanks actually captured for this game?
  // false for games logged before those questions existed (their stored
  // values are column defaults, not answers). Missing = treat as recorded.
  details_recorded?: boolean;
  card_year?: number; // which NMJL card this game was played with
}

// A round: up to 4 games played together, with a blanks house-rule flag.
export interface Round {
  id: string;
  started_at: string; // ISO timestamp
  blanks: boolean;
  closed_at?: string | null; // set when the round was ended before 4 games
}

// How games are being played: grouped into rounds of 4, or one at a time.
export type PlayMode = "rounds" | "single";

// Options captured when logging a win.
export interface WinOptions {
  jokerless: boolean;
  selfDrawn: boolean;
}

export type HandFilter = "all" | "won" | "unwon" | "favorites" | "recent";

// Yes / no / never asked. Used for optional details on older games.
export type Tracked = boolean | null;
