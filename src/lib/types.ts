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

// A single logged win, as stored in Supabase (or localStorage fallback).
export interface WinRecord {
  id?: string; // uuid from Supabase, or a temporary client id when offline
  hand_id: string;
  won_at: string; // ISO timestamp
}

export type HandFilter = "all" | "played" | "unplayed";
