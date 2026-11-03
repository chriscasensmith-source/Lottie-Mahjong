"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Hand, TileColor } from "@/lib/types";

export const COLOR_CLASS: Record<TileColor, string> = {
  green: "text-tile-green",
  red: "text-tile-red",
  blue: "text-tile-blue",
  neutral: "text-tile-neutral",
};

const BURST_COLORS = ["#5E1020", "#B9A06D", "#137a4b", "#c0392b", "#1f5fa8"];

// A short celebratory burst of colored tiles when a win is logged.
function Burst() {
  const pieces = Array.from({ length: 16 });
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      {pieces.map((_, i) => {
        const angle = (i / pieces.length) * Math.PI * 2;
        const dist = 60 + Math.random() * 70;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist - 20,
              opacity: 0,
              scale: 0.4,
              rotate: Math.random() * 360,
            }}
            transition={{ duration: 0.85, ease: "easeOut" }}
            className="absolute h-2.5 w-2.5 rounded-[3px]"
            style={{ backgroundColor: BURST_COLORS[i % BURST_COLORS.length] }}
          />
        );
      })}
    </div>
  );
}

interface HandCardProps {
  hand: Hand;
  winCount: number;
  note: string;
  celebrateKey: number; // bump to play the win burst on this card
  onRequestWin: (hand: Hand) => void;
  onUndo: (handId: string) => void;
  onNoteChange: (handId: string, text: string) => void;
}

export function HandCard({
  hand,
  winCount,
  note,
  celebrateKey,
  onRequestWin,
  onUndo,
  onNoteChange,
}: HandCardProps) {
  const played = winCount > 0;
  const [showBurst, setShowBurst] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    if (!celebrateKey) return;
    setShowBurst(true);
    const t = window.setTimeout(() => setShowBurst(false), 900);
    return () => window.clearTimeout(t);
  }, [celebrateKey]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      whileHover={{ y: -4 }}
      className={`relative flex flex-col overflow-hidden rounded-2xl text-maroon-900 shadow-[0_2px_10px_rgba(52,8,17,0.08)] ring-1 transition-all duration-200 ${
        played
          ? "bg-cream-200 opacity-60 grayscale ring-maroon-300 hover:bg-cream-50 hover:opacity-100 hover:grayscale-0"
          : "bg-cream-50 ring-maroon-900/10"
      }`}
    >
      <AnimatePresence>{showBurst && <Burst key={celebrateKey} />}</AnimatePresence>

      {/* Played badge */}
      <AnimatePresence>
        {played && (
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="absolute right-3 top-3 z-10 flex h-7 items-center gap-1 rounded-full bg-maroon-700 px-2.5 text-xs font-bold text-cream-50 shadow"
          >
            ✓ Played
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header: section + concealed/exposed + points */}
      <div className="flex items-center justify-between border-b border-maroon-900/10 px-4 pb-2 pt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-maroon-900/50">
          {hand.sectionId}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
              hand.concealed
                ? "bg-maroon-100 text-maroon-700"
                : "bg-cream-200 text-maroon-900/70"
            }`}
            title={hand.concealed ? "Concealed hand" : "Exposed hand"}
          >
            {hand.concealed ? "C" : "X"}
          </span>
          <span className="rounded-full bg-cream-300 px-2 py-0.5 text-sm font-extrabold text-maroon-900">
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
      <p className="px-4 pb-2 text-sm leading-snug text-maroon-900/65">{hand.description}</p>

      {/* Notes (collapsible, on-device) */}
      <AnimatePresence initial={false}>
        {notesOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4"
          >
            <textarea
              value={note}
              onChange={(e) => onNoteChange(hand.id, e.target.value)}
              placeholder="Your notes for this hand…"
              rows={2}
              className="mb-2 w-full resize-none rounded-lg border border-maroon-900/15 bg-white p-2 text-sm text-maroon-900 outline-none focus:border-maroon-500"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer: win count + actions */}
      <div className="flex items-center justify-between gap-2 border-t border-maroon-900/10 bg-cream-100 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-maroon-900/65">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={winCount}
              initial={{ y: -8, opacity: 0, scale: 0.6 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0, position: "absolute" }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              className="font-semibold tabular-nums text-maroon-900"
            >
              {winCount}
            </motion.span>
          </AnimatePresence>
          win{winCount === 1 ? "" : "s"}
          {played && (
            <button
              onClick={() => onUndo(hand.id)}
              className="ml-1 text-xs text-maroon-900/45 underline-offset-2 hover:text-maroon-700 hover:underline"
            >
              undo
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setNotesOpen((o) => !o)}
            title="Notes"
            className={`rounded-full px-2 py-1.5 text-sm transition-colors ${
              note ? "bg-cream-300 text-maroon-800" : "text-maroon-900/40 hover:bg-cream-200"
            }`}
          >
            📝
          </button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => onRequestWin(hand)}
            className="rounded-full bg-maroon-700 px-3.5 py-1.5 text-sm font-semibold text-cream-50 shadow-sm transition-colors hover:bg-maroon-800"
          >
            + Log win
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
