"use client";

import { motion } from "framer-motion";
import type { GameRecord } from "@/lib/types";
import { OUTCOME_META } from "@/lib/outcomes";
import { detailsRecorded, gamePoints, handById, isAlwaysJokerless } from "@/lib/stats";
import { COLOR_CLASS } from "@/components/HandCard";

interface GameRowProps {
  game: GameRecord;
  index?: number; // game number within its round
  meta?: string; // e.g. section name or date, shown under the label
  showDate?: boolean;
  onRemove?: (game: GameRecord) => void;
  // Single games: show a tappable Blanks / No blanks chip.
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
      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ring-1 ${o.soft} ${o.ring}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm text-white ${o.dot}`}
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
              <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                No jokers
              </span>
            )}
            {tracked && game.self_drawn && (
              <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                Self-drawn
              </span>
            )}
            {game.discarded_winner && (
              <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-tile-red">
                Threw it · {gamePoints(game)} pts
              </span>
            )}
            {game.tournament && (
              <span className="rounded bg-maroon-700 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cream-50">
                Tournament
              </span>
            )}
          </span>
          {hand && (
            <span className="flex flex-wrap gap-x-1 text-xs font-bold">
              {hand.pattern.map((p, i) => (
                <span key={i} className={COLOR_CLASS[p.color]}>
                  {p.text}
                </span>
              ))}
            </span>
          )}
          {meta && <span className="truncate text-xs text-maroon-900/70">{meta}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onToggleBlanks && (
          <button
            onClick={() => onToggleBlanks(game, !game.blanks)}
            title="Tap to switch blanks / no blanks"
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 transition-colors ${
              game.blanks
                ? "bg-maroon-700 text-cream-50 ring-maroon-700"
                : "bg-white/70 text-maroon-900/75 ring-maroon-900/15 hover:text-maroon-800"
            }`}
          >
            {game.blanks ? "Blanks" : "No blanks"}
          </button>
        )}
        <span className="text-xs text-maroon-900/75">{time}</span>
        {onRemove && (
          <button
            onClick={() => onRemove(game)}
            title="Remove this game"
            aria-label={`Remove this ${o.label.toLowerCase()}`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs text-maroon-900/65 transition-colors hover:bg-white/70 hover:text-maroon-700"
          >
            ✕
          </button>
        )}
      </div>
    </motion.li>
  );
}
