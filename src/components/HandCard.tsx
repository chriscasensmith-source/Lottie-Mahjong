"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Hand, TileColor } from "@/lib/types";
import { relativeTime } from "@/lib/stats";

export const COLOR_CLASS: Record<TileColor, string> = {
  green: "text-tile-green",
  red: "text-tile-red",
  blue: "text-tile-blue",
  neutral: "text-tile-neutral",
};

const COLOR_WORD: Record<TileColor, string> = { green: "green", red: "red", blue: "blue", neutral: "" };

// The pattern in words, with its ink colors, for screen readers and for
// telling apart hands whose tiles read the same: "222 green, 000 blue, …".
export function handColorText(hand: Hand): string {
  return hand.pattern.map((g) => (COLOR_WORD[g.color] ? `${g.text} ${COLOR_WORD[g.color]}` : g.text)).join(", ");
}

// The color-coded pattern, exactly as printed on the card. Colors are the
// card's own ink colors and are never changed. Screen readers get the colors
// in words unless `decorative` is set (when a parent already names the hand).
export function HandPattern({
  hand,
  className = "",
  decorative = false,
}: {
  hand: Hand;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span className={`flex flex-wrap items-center gap-x-[0.45em] gap-y-0.5 ${className}`}>
      {!decorative && <span className="sr-only">{handColorText(hand)}</span>}
      {hand.pattern.map((g, i) => (
        <span key={i} aria-hidden className={COLOR_CLASS[g.color]}>
          {g.text}
        </span>
      ))}
    </span>
  );
}

const BURST_COLORS = ["#5E1020", "#B9A06D", "#137a4b", "#c0392b", "#1f5fa8"];

// A short, small burst of colored tiles when a win is logged.
function Burst() {
  const pieces = Array.from({ length: 12 });
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      {pieces.map((_, i) => {
        const angle = (i / pieces.length) * Math.PI * 2;
        const dist = 50 + (i % 3) * 18;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 16, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
            className="absolute h-2 w-2 rounded-[3px]"
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
  lastWon?: string;
  note: string;
  favorite: boolean;
  celebrateKey: number; // bump to play the win burst on this card
  onRequestWin: (hand: Hand) => void;
  onUndo: (handId: string) => void;
  onNoteChange: (handId: string, text: string) => void;
  onToggleFavorite: (handId: string) => void;
}

export function HandCard({
  hand,
  winCount,
  lastWon,
  note,
  favorite,
  celebrateKey,
  onRequestWin,
  onUndo,
  onNoteChange,
  onToggleFavorite,
}: HandCardProps) {
  const won = winCount > 0;
  const reduce = useReducedMotion();
  const [showBurst, setShowBurst] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    if (!celebrateKey || reduce) return;
    setShowBurst(true);
    const t = window.setTimeout(() => setShowBurst(false), 800);
    return () => window.clearTimeout(t);
  }, [celebrateKey, reduce]);

  // "Saved" appears briefly after typing. Notes are written the moment they change.
  const [noteSaved, setNoteSaved] = useState(false);
  useEffect(() => {
    if (!noteSaved) return;
    const t = window.setTimeout(() => setNoteSaved(false), 2500);
    return () => window.clearTimeout(t);
  }, [noteSaved, note]);

  const name = hand.pattern.map((p) => p.text).join(" ");

  return (
    <motion.article
      layout={!reduce}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-label={`${handColorText(hand)}. ${hand.points} points, ${hand.concealed ? "concealed" : "exposed"}, ${won ? `won ${winCount} time${winCount === 1 ? "" : "s"}` : "not yet won"}`}
      className={`relative flex flex-col overflow-hidden rounded-2xl text-maroon-900 shadow-[0_1px_6px_rgba(52,8,17,0.06)] ring-1 transition-colors ${
        won ? "bg-cream-100 ring-gold/60" : "bg-cream-50 ring-maroon-900/10"
      }`}
    >
      {won && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gold" />}
      <AnimatePresence>{showBurst && <Burst key={celebrateKey} />}</AnimatePresence>

      {/* Header: section, won badge, exposed/concealed, points */}
      <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-maroon-900/75">{hand.sectionId}</span>
          {won && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-maroon-700 px-2 py-0.5 text-xs font-bold text-cream-50">
              ✓ Won
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
              hand.concealed ? "bg-maroon-100 text-maroon-800" : "bg-cream-200 text-maroon-900/85"
            }`}
            title={hand.concealed ? "Concealed: no exposed groups allowed" : "Exposed: groups may be exposed"}
          >
            {hand.concealed ? "Concealed" : "Exposed"}
          </span>
          <span className="rounded-md bg-cream-300/70 px-1.5 py-0.5 text-xs font-bold tabular-nums text-maroon-900">
            {hand.points} pts
          </span>
        </div>
      </div>

      {/* Pattern (the card's own ink colors) — never grayed out */}
      <HandPattern
        hand={hand}
        decorative
        className="flex-1 px-4 py-2.5 text-2xl font-extrabold tracking-tight [overflow-wrap:anywhere] sm:text-[1.7rem]"
      />

      <p className="px-4 pb-2 text-base leading-snug text-maroon-900/80">{hand.description}</p>

      {/* Notes (kept on this device) */}
      <AnimatePresence initial={false}>
        {notesOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4"
          >
            <label className="text-sm font-semibold text-maroon-900" htmlFor={`note-${hand.id}`}>
              My notes for this hand
            </label>
            <textarea
              id={`note-${hand.id}`}
              value={note}
              onChange={(e) => {
                onNoteChange(hand.id, e.target.value);
                setNoteSaved(true);
              }}
              placeholder="For example: good when I start with lots of flowers"
              rows={3}
              className="mt-1 w-full resize-y rounded-xl border-2 border-maroon-900/20 bg-white p-2.5 text-base text-maroon-900 outline-none placeholder:text-maroon-900/50 focus:border-maroon-600"
            />
            <p className="mb-2 text-sm text-maroon-900/75" role="status">
              {noteSaved ? "✓ Saved on this device" : "Notes save as you type and stay on this device."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer: win count + actions */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-maroon-900/10 bg-cream-100/70 px-3 py-2">
        <div className="flex min-w-0 flex-col pl-1 text-base text-maroon-900/85">
          <span>
            <span className="font-semibold tabular-nums text-maroon-900">{winCount}</span> win
            {winCount === 1 ? "" : "s"}
          </span>
          {lastWon && <span className="text-sm text-maroon-900/75">Last won {relativeTime(lastWon)}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onToggleFavorite(hand.id)}
            aria-pressed={favorite}
            aria-label={`${favorite ? "Remove from favorites" : "Add to favorites"}: ${name}`}
            title={favorite ? "Remove from favorites" : "Add to favorites"}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-xl transition-colors ${
              favorite ? "text-gold-dark" : "text-maroon-900/65 hover:bg-cream-200 hover:text-maroon-800"
            }`}
          >
            {favorite ? "★" : "☆"}
          </button>
          <button
            onClick={() => setNotesOpen((o) => !o)}
            aria-expanded={notesOpen}
            aria-label={`${note ? "Notes (has a note)" : "Notes"}: ${name}`}
            className={`flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold transition-colors ${
              note ? "bg-cream-300 text-maroon-800" : "text-maroon-800 ring-1 ring-maroon-900/15 hover:bg-cream-200"
            }`}
          >
            <span aria-hidden>📝</span> Notes
          </button>
          <button
            onClick={() => onRequestWin(hand)}
            aria-label={`Log a win with ${name}`}
            className="min-h-11 rounded-full bg-maroon-700 px-4 text-base font-semibold text-cream-50 shadow-sm transition-colors hover:bg-maroon-800"
          >
            Log win
          </button>
        </div>
      </div>
      {won && (
        <div className="border-t border-maroon-900/10 bg-cream-100/70 px-3 pb-1.5">
          <button
            onClick={() => onUndo(hand.id)}
            aria-label={`Remove the most recent win with ${name}`}
            className="min-h-11 px-1 text-sm font-semibold text-maroon-700 underline underline-offset-2"
          >
            Remove last win…
          </button>
        </div>
      )}
    </motion.article>
  );
}
