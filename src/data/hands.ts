import type { Section } from "@/lib/types";

// ---------------------------------------------------------------------------
// PLACEHOLDER DATA
// ---------------------------------------------------------------------------
// These are sample hands so the UI renders during scaffolding. They are NOT a
// real NMJL card. Replace them with the actual hands, colors, points, and
// instructions from your three photos (see README "Adding your real hands").
//
// Colors map to the ink colors on the physical card:
//   green  -> tile.green
//   red    -> tile.red
//   blue   -> tile.blue
//   neutral-> tile.neutral (used for flowers/winds/dragons text, etc.)
// ---------------------------------------------------------------------------

export const SECTIONS: Section[] = [
  {
    id: "2025",
    name: "2025",
    note: "Any like pairs of the year",
    accentClass: "text-tile-green",
    hands: [
      {
        id: "2025-1",
        sectionId: "2025",
        pattern: [
          { text: "FF", color: "green" },
          { text: "2025", color: "green" },
          { text: "2025", color: "red" },
        ],
        points: 25,
        concealed: false,
        description: "Flowers + year in two suits.",
      },
      {
        id: "2025-2",
        sectionId: "2025",
        pattern: [
          { text: "FFFF", color: "green" },
          { text: "2025", color: "blue" },
          { text: "DDDD", color: "blue" },
        ],
        points: 30,
        concealed: false,
        description: "Quint flowers, year, dragons (1 suit).",
      },
    ],
  },
  {
    id: "2468",
    name: "2468",
    note: "Even numbers only",
    accentClass: "text-tile-red",
    hands: [
      {
        id: "2468-1",
        sectionId: "2468",
        pattern: [
          { text: "222", color: "green" },
          { text: "44", color: "green" },
          { text: "666", color: "green" },
          { text: "88", color: "green" },
        ],
        points: 25,
        concealed: false,
        description: "Pungs and pairs of evens, 1 suit.",
      },
      {
        id: "2468-2",
        sectionId: "2468",
        pattern: [
          { text: "FF", color: "neutral" },
          { text: "2468", color: "red" },
          { text: "2468", color: "blue" },
        ],
        points: 30,
        concealed: true,
        description: "Concealed: flowers + evens run in two suits.",
      },
    ],
  },
  {
    id: "singles-pairs",
    name: "Singles & Pairs",
    note: "Concealed only",
    accentClass: "text-tile-blue",
    hands: [
      {
        id: "sp-1",
        sectionId: "singles-pairs",
        pattern: [
          { text: "11", color: "green" },
          { text: "22", color: "red" },
          { text: "33", color: "blue" },
          { text: "44", color: "green" },
          { text: "55", color: "red" },
        ],
        points: 50,
        concealed: true,
        description: "Pairs of consecutive numbers across suits.",
      },
    ],
  },
];

// Flat list of every hand, handy for lookups and counts.
export const ALL_HANDS = SECTIONS.flatMap((s) => s.hands);
