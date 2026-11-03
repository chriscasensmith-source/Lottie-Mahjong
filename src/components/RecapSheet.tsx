"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { DayRecap } from "@/lib/stats";
import { dayKeyToDate, fmtNum, fmtPct } from "@/lib/stats";
import { HandPattern } from "@/components/HandCard";
import { DaySummary } from "@/components/DaySummary";

interface RecapSheetProps {
  dayKey: string | null; // null = closed
  recap: DayRecap | null;
  onClose: () => void;
}

// A short, optional recap of one playing day. Never blocks logging.
export function RecapSheet({ dayKey, recap, onClose }: RecapSheetProps) {
  useEffect(() => {
    if (!dayKey) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dayKey, onClose]);

  const label = dayKey
    ? dayKeyToDate(dayKey).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <AnimatePresence>
      {dayKey && recap && (
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
            aria-label="Day recap"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-cream-50 p-5 shadow-2xl ring-1 ring-maroon-900/10 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="card-title">Day recap</p>
                <h2 className="mt-0.5 font-display text-xl font-bold text-maroon-800">{label}</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full text-maroon-900/70 hover:bg-cream-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <DaySummary recap={recap} />
            </div>

            <p className="mt-3 text-sm text-maroon-900/80">
              Decisive-game win rate:{" "}
              <span className="font-semibold text-maroon-900">{fmtPct(recap.totals.decisiveRate)}</span>
              {recap.totals.decided > 0 && (
                <span className="text-maroon-900/70">
                  {" "}
                  ({recap.totals.win} of {recap.totals.decided} decided games)
                </span>
              )}
              {recap.uniqueHands > 0 && (
                <>
                  <br />
                  {recap.uniqueHands} different hand{recap.uniqueHands === 1 ? "" : "s"} won ·{" "}
                  {fmtNum(recap.points)} hand points
                </>
              )}
            </p>

            {recap.firstTimeHands.length > 0 && (
              <div className="mt-4 rounded-2xl bg-gold-light/50 p-3 ring-1 ring-gold/50">
                <p className="text-xs font-bold uppercase tracking-wide text-gold-dark">
                  ✨ First-time win{recap.firstTimeHands.length === 1 ? "" : "s"}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {recap.firstTimeHands.map((h) => (
                    <li key={h.id}>
                      <HandPattern hand={h} className="text-sm font-extrabold" />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-5 min-h-11 w-full rounded-full bg-maroon-700 text-sm font-semibold text-cream-50 hover:bg-maroon-800"
            >
              Done
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
