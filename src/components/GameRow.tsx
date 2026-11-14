"use client";

import { motion } from "framer-motion";
import type { GameRecord } from "@/lib/types";
import { OUTCOME_META } from "@/lib/outcomes";
import { detailsRecorded, gamePoints, handById, isAlwaysJokerless } from "@/lib/stats";
import { HandPattern } from "@/components/HandCard";

interface GameRowProps {
  game: GameRecord;
  index?: number; // game number within its round
  meta?: string; // e.g. section name or date, shown under the label
  showDate?: boolean;
  onRemove?: (game: GameRecord) => void;
  // Single games: show the blanks setting, with a separate, confirmed Change action.
  onToggleBlanks?: (game: GameRecord, blanks: boolean) => void;
}

export function GameRow({ game, index, meta, showDate, onRemove, onToggleBlanks }: GameRowProps) {
  const o = OUTCOME_META[game.outcome];
  const hand = game.hand_id ? handById(game.hand_id) : null;
  const when = new Date(game.won_at);
  const time = showDate
    ? when.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const tracked = detailsRecorded(game);
  const noJokers = tracked && game.outcome === "win" && game.jokerless && hand && !isAlwaysJokerless(hand.id);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`rounded-xl px-3 py-2 ring-1 ${o.soft} ${o.ring}`}
    >
      <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-white ${o.dot}`}
          aria-hidden
        >
          {o.emoji}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className={`flex flex-wrap items-center gap-x-1.5 text-sm font-semibold ${o.ink}`}>
            {index !== undefined && <span className="font-normal opacity-70">Game {index}</span>}
            {o.label}
            {hand && <span>· {gamePoints(game)} pts</span>}
            {noJokers && (
              <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs font-bold">
                No jokers
              </span>
            )}
            {tracked && game.self_drawn && (
              <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs font-bold">
                Self-drawn
              </span>
            )}
            {game.discarded_winner && (
              <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs font-bold text-tile-red">
                Threw it · {gamePoints(game)} pts
              </span>
            )}
            {game.tournament && (
              <span className="rounded bg-maroon-700 px-1.5 py-0.5 text-xs font-bold text-cream-50">
                Tournament
              </span>
            )}
          </span>
          {meta && <span className="truncate text-sm text-maroon-900/75">{meta}</span>}
          {onToggleBlanks && (
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-maroon-900/85">
              <span>Played with {game.blanks ? "blanks" : "no blanks"}</span>
              <button
                onClick={() => onToggleBlanks(game, !game.blanks)}
                aria-label={`Change this ${o.label.toLowerCase()} from ${time} to ${game.blanks ? "no blanks" : "blanks"}`}
                className="min-h-11 px-1 font-semibold text-maroon-700 underline underline-offset-2"
              >
                Change…
              </button>
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-sm text-maroon-900/80">{time}</span>
        {onRemove && (
          <button
            onClick={() => onRemove(game)}
            title="Delete this game"
            aria-label={`Delete this ${o.label.toLowerCase()} from ${time}`}
            className="flex h-11 w-11 items-center justify-center rounded-full text-base text-maroon-900/70 transition-colors hover:bg-white/70 hover:text-tile-red"
          >
            <span aria-hidden>🗑</span>
          </button>
        )}
      </div>
      </div>
      {/* The winning hand on one line, across the full width of the row */}
      {hand && (
        <HandPattern
          hand={hand}
          className="mt-1 flex-nowrap whitespace-nowrap text-[clamp(0.8rem,4.1vw,1.1rem)] font-extrabold"
        />
      )}
    </motion.li>
  );
}
