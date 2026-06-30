"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SECTIONS, ALL_HANDS } from "@/data/hands";
import { useWins } from "@/hooks/useWins";
import { StatsBar } from "@/components/StatsBar";
import { FilterBar } from "@/components/FilterBar";
import { HandCard } from "@/components/HandCard";
import type { HandFilter } from "@/lib/types";

export default function Home() {
  const { counts, loading, totalWins, playedCount, logWin, undoWin, backend } =
    useWins();
  const [filter, setFilter] = useState<HandFilter>("all");

  const sections = useMemo(() => {
    return SECTIONS.map((section) => {
      const hands = section.hands.filter((hand) => {
        const played = (counts[hand.id] ?? 0) > 0;
        if (filter === "played") return played;
        if (filter === "unplayed") return !played;
        return true;
      });
      return { ...section, hands };
    }).filter((section) => section.hands.length > 0);
  }, [counts, filter]);

  return (
    <main className="felt-texture mx-auto min-h-dvh max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      {/* Header */}
      <header className="flex flex-col items-center gap-5 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            🀄 Lottie Mahjong
          </h1>
          <p className="mt-1 text-emerald-100/70">
            Track the hands you&apos;ve played and won.
          </p>
        </motion.div>

        <StatsBar
          totalHands={ALL_HANDS.length}
          playedCount={playedCount}
          totalWins={totalWins}
        />

        <FilterBar value={filter} onChange={setFilter} />

        <p className="text-xs text-emerald-100/40">
          {backend === "supabase"
            ? "Synced to Supabase"
            : "Saved on this device (offline mode)"}
        </p>
      </header>

      {/* Body */}
      {loading ? (
        <div className="mt-20 text-center text-emerald-100/60">Loading…</div>
      ) : (
        <div className="mt-10 space-y-10">
          <AnimatePresence mode="popLayout">
            {sections.map((section) => (
              <motion.section
                key={section.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-3 flex items-baseline gap-3">
                  <h2 className={`text-2xl font-bold ${section.accentClass}`}>
                    {section.name}
                  </h2>
                  {section.note && (
                    <span className="text-sm text-emerald-100/50">
                      {section.note}
                    </span>
                  )}
                </div>
                <motion.div
                  layout
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  <AnimatePresence mode="popLayout">
                    {section.hands.map((hand) => (
                      <HandCard
                        key={hand.id}
                        hand={hand}
                        winCount={counts[hand.id] ?? 0}
                        onLogWin={logWin}
                        onUndo={undoWin}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </motion.section>
            ))}
          </AnimatePresence>

          {sections.length === 0 && (
            <div className="mt-20 text-center text-emerald-100/60">
              No hands match this filter.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
