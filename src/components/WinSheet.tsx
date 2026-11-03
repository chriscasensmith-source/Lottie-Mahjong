"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Hand, WinOptions } from "@/lib/types";
import { isAlwaysJokerless, winPoints } from "@/lib/stats";
import { COLOR_CLASS } from "@/components/HandCard";

// Two-option segmented toggle.
export function Segmented<T extends string | boolean>({
  value,
  options,
  onChange,
  disabled,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "min-h-8 px-2.5 py-1 text-xs" : "min-h-10 px-3.5 py-1.5 text-sm";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-full bg-cream-200 p-1 ring-1 ring-maroon-900/10 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`whitespace-nowrap rounded-full font-semibold transition-colors ${pad} ${
              active ? "bg-maroon-700 text-cream-50 shadow-sm" : "text-maroon-800 hover:bg-cream-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface WinSheetProps {
  hand: Hand | null; // null = closed
  at?: Date; // set when backdating from the calendar
  roundLabel: string;
  onConfirm: (opts: WinOptions) => void;
  onClose: () => void;
}

export function WinSheet({ hand, at, roundLabel, onConfirm, onClose }: WinSheetProps) {
  const [jokerless, setJokerless] = useState(false);
  const [selfDrawn, setSelfDrawn] = useState(false);
  // Locks the confirm button after the first tap so a double-tap can't log twice.
  const [submitted, setSubmitted] = useState(false);

  const alwaysJokerless = hand ? isAlwaysJokerless(hand.id) : false;

  // Reset toggles each time a new hand opens the sheet.
  useEffect(() => {
    if (!hand) return;
    setJokerless(isAlwaysJokerless(hand.id));
    setSelfDrawn(false);
    setSubmitted(false);
  }, [hand]);

  useEffect(() => {
    if (!hand) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hand, onClose]);

  const pts = hand ? winPoints(hand.id, { jokerless, selfDrawn }) : null;
  const dateLabel = at
    ? at.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    : null;

  return (
    <AnimatePresence>
      {hand && pts && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-maroon-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Log a win"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-cream-50 p-5 shadow-2xl ring-1 ring-maroon-900/10 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-maroon-800">Log a win 🏆</h2>
                <p className="mt-0.5 text-xs text-maroon-900/75">
                  {dateLabel ? `${dateLabel} · ` : ""}
                  {roundLabel}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-full px-2 py-1 text-maroon-900/65 hover:bg-cream-200 hover:text-maroon-800"
              >
                ✕
              </button>
            </div>

            {/* The hand */}
            <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-maroon-900/10">
              <div className="flex flex-wrap gap-x-2 text-xl font-extrabold">
                {hand.pattern.map((g, i) => (
                  <span key={i} className={COLOR_CLASS[g.color]}>
                    {g.text}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-xs text-maroon-900/75">
                {hand.description} · {hand.points} pts · {hand.concealed ? "Concealed" : "Exposed"}
              </p>
            </div>

            {/* Toggles */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-maroon-900">Jokers</span>
                <Segmented
                  label="Jokers"
                  value={jokerless}
                  disabled={alwaysJokerless}
                  onChange={setJokerless}
                  options={[
                    { value: false, label: "Jokers" },
                    { value: true, label: "No jokers" },
                  ]}
                />
              </div>
              {alwaysJokerless && (
                <p className="-mt-1 text-right text-xs text-maroon-900/70">
                  Singles &amp; Pairs never use jokers, so no bonus.
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-maroon-900">How you won</span>
                <Segmented
                  label="How you won"
                  value={selfDrawn}
                  onChange={setSelfDrawn}
                  options={[
                    { value: false, label: "Discard" },
                    { value: true, label: "Self-drawn" },
                  ]}
                />
              </div>
            </div>

            {/* Points preview */}
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-maroon-50 px-4 py-3 ring-1 ring-maroon-200">
              <span className="text-xs text-maroon-900/70">
                {pts.base}
                {pts.jokerlessBonus && " × 2 no jokers"}
                {selfDrawn && " × 2 self-drawn"}
              </span>
              <motion.span
                key={pts.total}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-display text-2xl font-bold tabular-nums text-maroon-700"
              >
                {pts.total} pts
              </motion.span>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={onClose}
                className="min-h-11 flex-1 rounded-full bg-cream-200 py-2.5 text-sm font-semibold text-maroon-800 hover:bg-cream-300"
              >
                Cancel
              </button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                disabled={submitted}
                onClick={() => {
                  if (submitted) return;
                  setSubmitted(true);
                  onConfirm({ jokerless, selfDrawn });
                }}
                className="min-h-11 flex-[2] rounded-full disabled:opacity-70 bg-maroon-700 py-2.5 text-sm font-semibold text-cream-50 shadow hover:bg-maroon-800"
              >
                Log win · {pts.total} pts
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
