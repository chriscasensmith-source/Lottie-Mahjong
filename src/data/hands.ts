import type { Section } from "@/lib/types";

// ---------------------------------------------------------------------------
// 2026 National Mah Jongg League (NMJL) card — transcribed from photos.
// ---------------------------------------------------------------------------
// NOTE: White Dragon is used as zero "0". It may be used with any suit.
//
// Colors map to the printed ink on the card:
//   green  -> tile.green
//   red    -> tile.red
//   blue   -> tile.blue
//   neutral-> tile.neutral (black)
// concealed: true = "C" (concealed), false = "X" (exposed)
//
// STATUS: Sections 2026 + 2468 entered for verification. The remaining six
// sections (Quints, Consecutive Run, 13579, Winds-Dragons, 369, Singles &
// Pairs) are being added section-by-section after a colors/points check.
// ---------------------------------------------------------------------------

export const SECTIONS: Section[] = [
  {
    id: "2026",
    name: "2026",
    accentClass: "text-tile-green",
    hands: [
      {
        id: "2026-1",
        sectionId: "2026",
        pattern: [
          { text: "222", color: "green" },
          { text: "000", color: "red" },
          { text: "2222", color: "red" },
          { text: "6666", color: "red" },
        ],
        points: 25,
        concealed: false,
        description: "Any 2 Suits.",
      },
      {
        id: "2026-2",
        sectionId: "2026",
        pattern: [
          { text: "2026", color: "green" },
          { text: "DDD", color: "red" },
          { text: "2222", color: "red" },
          { text: "DDD", color: "red" },
        ],
        points: 25,
        concealed: false,
        description: "Any 2 Suits w Matching Dragons. Kong 2 or 6.",
      },
      {
        id: "2026-3",
        sectionId: "2026",
        pattern: [
          { text: "FFF", color: "green" },
          { text: "2026", color: "red" },
          { text: "2222", color: "green" },
          { text: "6666", color: "red" },
        ],
        points: 25,
        concealed: false,
        description: "Any 3 Suits.",
      },
      {
        id: "2026-4",
        sectionId: "2026",
        pattern: [
          { text: "22", color: "green" },
          { text: "00", color: "red" },
          { text: "222", color: "green" },
          { text: "666", color: "red" },
          { text: "NEWS", color: "blue" },
        ],
        points: 30,
        concealed: false,
        description: "Any 2 Suits.",
      },
    ],
  },
  {
    id: "2468",
    name: "2468",
    accentClass: "text-tile-red",
    hands: [
      {
        id: "2468-1",
        sectionId: "2468",
        pattern: [
          { text: "222", color: "green" },
          { text: "444", color: "green" },
          { text: "6666", color: "red" },
          { text: "8888", color: "red" },
        ],
        points: 25,
        concealed: false,
        description: "Any 1 or 2 Suits.",
      },
      {
        id: "2468-2",
        sectionId: "2468",
        pattern: [
          { text: "222", color: "green" },
          { text: "444", color: "green" },
          { text: "6666", color: "green" },
          { text: "8888", color: "green" },
        ],
        points: 25,
        concealed: false,
        description: "Any 1 Suit. (Also valid as 222 444 6666 88.)",
      },
      {
        id: "2468-3",
        sectionId: "2468",
        pattern: [
          { text: "EE", color: "green" },
          { text: "22", color: "red" },
          { text: "444", color: "red" },
          { text: "666", color: "red" },
          { text: "88", color: "red" },
          { text: "WW", color: "green" },
        ],
        points: 30,
        concealed: false,
        description: "Any 2 Suits. East and West Only.",
      },
      {
        id: "2468-4",
        sectionId: "2468",
        pattern: [
          { text: "2222", color: "green" },
          { text: "DDDD", color: "red" },
          { text: "8888", color: "green" },
          { text: "DDDD", color: "red" },
        ],
        points: 30,
        concealed: false,
        description: "Any 2 Suits w Matching Dragons. These Nos. Only.",
      },
      {
        id: "2468-5",
        sectionId: "2468",
        pattern: [
          { text: "2468", color: "green" },
          { text: "2222", color: "red" },
          { text: "D", color: "red" },
          { text: "2222", color: "green" },
          { text: "D", color: "green" },
        ],
        points: 25,
        concealed: false,
        description: "Any 3 Suits. Like Kongs 2, 4, 6 or 8 w Matching Dragon.",
      },
      {
        id: "2468-6",
        sectionId: "2468",
        pattern: [
          { text: "2468", color: "green" },
          { text: "FFF", color: "red" },
          { text: "2222", color: "red" },
        ],
        points: 30,
        concealed: false,
        description: "Any 2 Suits. Kong 2, 4, 6 or 8.",
      },
      {
        id: "2468-7",
        sectionId: "2468",
        pattern: [
          { text: "FF", color: "green" },
          { text: "246", color: "red" },
          { text: "888", color: "red" },
          { text: "246", color: "green" },
          { text: "888", color: "green" },
        ],
        points: 30,
        concealed: false,
        description: "Any 2 Suits.",
      },
    ],
  },
];

// Flat list of every hand, handy for lookups and counts.
export const ALL_HANDS = SECTIONS.flatMap((s) => s.hands);
