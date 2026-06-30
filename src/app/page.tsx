"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SECTIONS, ALL_HANDS } from "@/data/hands";
import { useWins } from "@/hooks/useWins";
import { useNotes } from "@/hooks/useNotes";
import { StatsBar } from "@/components/StatsBar";
import { FilterBar } from "@/components/FilterBar";
import { HandCard } from "@/components/HandCard";
import { StatsView } from "@/components/StatsView";
import type { Hand, HandFilter } from "@/lib/types";

type View = "hands" | "stats";

function handMatches(hand: Hand, sectionName: string, q: string): boolean {
  if (!q) return true;
  const haystack = (
    sectionName +
    " " +
    hand.description +
    " " +
    hand.pattern.map((p) => p.text).join(" ")
  ).toLowerCase();
  return haystack.includes(q);
}

export default function Home() {
  const { records, counts, loading, totalWins, playedCount, logWin, undoWin, backend } =
    useWins();
  const { notes, setNote } = useNotes();
  const [view, setView] = useState<View>("hands");
  const [filter, setFilter] = useState<HandFilter>("all");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const sections = useMemo(() => {
    return SECTIONS.map((section) => {
      const hands = section.hands.filter((hand) => {
        const played = (counts[hand.id] ?? 0) > 0;
        if (filter === "played" && !played) return false;
        if (filter === "unplayed" && played) return false;
        return handMatches(hand, section.name, q);
      });
      return { ...section, hands };
    }).filter((section) => section.hands.length > 0);
  }, [counts, filter, q]);

  function jumpTo(id: string) {
    document
      .getElementById(`sec-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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

        {/* View switcher */}
        <div className="inline-flex rounded-full bg-black/25 p-1 backdrop-blur">
          {(["hands", "stats"] as View[]).map((v) => {
            const active = view === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className="relative rounded-full px-5 py-1.5 text-sm font-semibold capitalize"
              >
                {active && (
                  <motion.span
                    layoutId="view-pill"
                    className="absolute inset-0 rounded-full bg-emerald-400"
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  />
                )}
                <span
                  className={`relative z-10 ${
                    active ? "text-emerald-950" : "text-emerald-100/80"
                  }`}
                >
                  {v === "hands" ? "🀙 Hands" : "📊 Stats"}
                </span>
              </button>
            );
          })}
        </div>

        <StatsBar
          totalHands={ALL_HANDS.length}
          playedCount={playedCount}
          totalWins={totalWins}
        />

        <p className="text-xs text-emerald-100/40">
          {backend === "supabase"
            ? "Synced to Supabase"
            : "Saved on this device (offline mode)"}
        </p>
      </header>

      {/* Body */}
      {loading ? (
        <div className="mt-20 text-center text-emerald-100/60">Loading…</div>
      ) : view === "stats" ? (
        <StatsView records={records} />
      ) : (
        <>
          {/* Controls */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <FilterBar value={filter} onChange={setFilter} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search hands…"
                className="w-56 rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm text-emerald-50 placeholder:text-emerald-100/40 outline-none backdrop-blur focus:border-emerald-400"
              />
            </div>

            {/* Section quick-nav */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => jumpTo(s.id)}
                  className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-emerald-100/70 ring-1 ring-white/10 transition-colors hover:bg-white/15 hover:text-white"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 space-y-10">
            <AnimatePresence mode="popLayout">
              {sections.map((section) => (
                <motion.section
                  key={section.id}
                  id={`sec-${section.id}`}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="scroll-mt-4"
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
                          note={notes[hand.id] ?? ""}
                          onLogWin={logWin}
                          onUndo={undoWin}
                          onNoteChange={setNote}
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
        </>
      )}

      <footer className="mt-16 text-center text-xs text-emerald-100/30">
        2026 National Mah Jongg League card · {ALL_HANDS.length} hands ·
        made for Lottie 🀄
      </footer>
    </main>
  );
}
