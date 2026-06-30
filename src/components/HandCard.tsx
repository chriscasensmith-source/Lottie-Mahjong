"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Hand, TileColor } from "@/lib/types";

const COLOR_CLASS: Record<TileColor, string> = {
  green: "text-tile-green",
  red: "text-tile-red",
  blue: "text-tile-blue",
  neutral: "text-tile-neutral",
};

interface HandCardProps {
  hand: Hand;
  winCount: number;
  onLogWin: (handId: string) => void;
  onUndo: (handId: string) => void;
}

export function HandCard({ hand, winCount, onLogWin, onUndo }: HandCardProps) {
  const played = winCount > 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      whileHover={{ y: -4 }}
      className={`relative flex flex-col overflow-hidden rounded-2xl bg-stone-50 text-stone-900 shadow-lg ring-2 transition-shadow ${
        played ? "ring-emerald-400" : "ring-transparent"
      }`}
    >
      {/* Played badge */}
      <AnimatePresence>
        {played && (
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="absolute right-3 top-3 z-10 flex h-7 items-center gap-1 rounded-full bg-emerald-500 px-2 text-xs font-bold text-white shadow"
          >
            ✓ Played
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header: section + points + concealed/exposed */}
      <div className="flex items-center justify-between border-b border-stone-200 px-4 pb-2 pt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {hand.sectionId}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
              hand.concealed
                ? "bg-purple-100 text-purple-700"
                : "bg-sky-100 text-sky-700"
            }`}
            title={hand.concealed ? "Concealed hand" : "Exposed hand"}
          >
            {hand.concealed ? "C" : "X"}
          </span>
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-sm font-extrabold text-amber-950">
            {hand.points}
          </span>
        </div>
      </div>

      {/* Pattern (color-coded ink, like the printed card) */}
      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {hand.pattern.map((group, i) => (
          <span key={i} className={COLOR_CLASS[group.color]}>
            {group.text}
          </span>
        ))}
      </div>

      {/* Instruction */}
      <p className="px-4 pb-3 text-sm leading-snug text-stone-600">
        {hand.description}
      </p>

      {/* Footer: win count + actions */}
      <div className="flex items-center justify-between gap-2 border-t border-stone-200 bg-stone-100/70 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <span className="font-semibold text-stone-900 tabular-nums">
            {winCount}
          </span>
          win{winCount === 1 ? "" : "s"}
          {played && (
            <button
              onClick={() => onUndo(hand.id)}
              className="ml-1 text-xs text-stone-400 underline-offset-2 hover:text-stone-700 hover:underline"
            >
              undo
            </button>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => onLogWin(hand.id)}
          className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          + Log win
        </motion.button>
      </div>
    </motion.article>
  );
}
