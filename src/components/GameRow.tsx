"use client";

import { motion } from "framer-motion";
import type { GameRecord } from "@/lib/types";
import { OUTCOME_META } from "@/lib/outcomes";
import { gamePoints, handById, isAlwaysJokerless } from "@/lib/stats";
import { COLOR_CLASS } from "@/components/HandCard";

interface GameRowProps {
  game: GameRecord;
  index?: number; // game number within its round
  meta?: string; // e.g. section name or date, shown under the label
  showDate?: boolean;
  onRemove?: (game: GameRecord) => void;
}

export function GameRow({ game, index, meta, showDate, onRemove }: GameRowProps) {
  const o = OUTCOME_META[game.outcome];
  const hand = game.hand_id ? handById(game.hand_id) : null;
  const when = new Date(game.won_at);
  const time = showDate
    ? when.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const noJokers = game.outcome === "win" && game.jokerless && hand && !isAlwaysJokerless(hand.id);

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
            {game.self_drawn && (
              <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                Self-drawn
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
          {meta && <span className="truncate text-xs text-maroon-900/50">{meta}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-xs text-maroon-900/50">{time}</span>
        {onRemove && (
          <button
            onClick={() => onRemove(game)}
            title="Remove this game"
            aria-label="Remove this game"
            className="rounded-full px-1.5 py-0.5 text-xs text-maroon-900/40 transition-colors hover:bg-white/70 hover:text-maroon-700"
          >
            ✕
          </button>
        )}
      </div>
    </motion.li>
  );
}
