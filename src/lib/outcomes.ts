import type { GameOutcome } from "@/lib/types";

// Shared look for game outcomes. Color is never the only signal — every use
// pairs it with the emoji and/or label.
export const OUTCOME_META: Record<
  GameOutcome,
  {
    label: string;
    emoji: string;
    dot: string; // solid fill (slots, legend swatches, bars)
    soft: string; // tinted background (rows, chips)
    ink: string; // readable text on the soft background
    ring: string;
  }
> = {
  win: {
    label: "Win",
    emoji: "🏆",
    dot: "bg-outcome-win",
    soft: "bg-outcome-win-soft",
    ink: "text-outcome-win-ink",
    ring: "ring-outcome-win/40",
  },
  loss: {
    label: "Loss",
    emoji: "❌",
    dot: "bg-outcome-loss",
    soft: "bg-outcome-loss-soft",
    ink: "text-outcome-loss-ink",
    ring: "ring-outcome-loss/40",
  },
  wall: {
    label: "Wall game",
    emoji: "🧱",
    dot: "bg-outcome-wall",
    soft: "bg-outcome-wall-soft",
    ink: "text-outcome-wall-ink",
    ring: "ring-outcome-wall/40",
  },
};
