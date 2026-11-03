"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SECTIONS } from "@/data/hands";
import type { Hand } from "@/lib/types";
import { HandPattern } from "@/components/HandCard";

interface HandPickerProps {
  open: boolean;
  recent: Hand[]; // recently won hands, newest first
  onPick: (hand: Hand) => void;
  onClose: () => void;
}

function matches(hand: Hand, sectionName: string, q: string) {
  if (!q) return true;
  return (sectionName + " " + hand.description + " " + hand.pattern.map((p) => p.text).join(" "))
    .toLowerCase()
    .includes(q);
}

// "Which hand did you win with?" One search box, recent hands first, then the card.
export function HandPicker({ open, recent, onPick, onClose }: HandPickerProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const groups = useMemo(() => {
    const out: { id: string; name: string; hands: Hand[] }[] = [];
    if (!q && recent.length) out.push({ id: "recent", name: "Recently won", hands: recent });
    for (const s of SECTIONS) {
      const hands = s.hands.filter((h) => matches(h, s.name, q));
      if (hands.length) out.push({ id: s.id, name: s.name, hands });
    }
    return out;
  }, [q, recent]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-maroon-900/40 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Pick the winning hand"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-cream-50 shadow-2xl ring-1 ring-maroon-900/10 sm:rounded-3xl"
          >
            <div className="border-b border-maroon-900/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-maroon-800">Which hand? 🏆</h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-maroon-900/70 hover:bg-cream-200"
                >
                  ✕
                </button>
              </div>
              <label htmlFor="pick-search" className="sr-only">
                Search hands
              </label>
              <input
                id="pick-search"
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search, e.g. 2468 or NEWS"
                className="mt-2 min-h-11 w-full rounded-full border border-maroon-900/20 bg-white px-4 text-base text-maroon-900 outline-none placeholder:text-maroon-900/55 focus:border-maroon-500"
              />
            </div>
            <div className="overflow-y-auto px-4 pb-4">
              {groups.map((g) => (
                <section key={g.id} className="pt-3" aria-label={g.name}>
                  <h3 className="card-title mb-1.5">{g.name}</h3>
                  <ul className="space-y-1.5">
                    {g.hands.map((h) => (
                      <li key={`${g.id}-${h.id}`}>
                        <button
                          onClick={() => onPick(h)}
                          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-left ring-1 ring-maroon-900/10 hover:ring-maroon-500"
                        >
                          <HandPattern hand={h} className="text-base font-extrabold" />
                          <span className="shrink-0 text-xs text-maroon-900/75">{h.points} pts</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {groups.length === 0 && <p className="pt-6 text-center text-sm text-maroon-900/75">No hands match.</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
