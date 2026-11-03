"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SECTIONS, ALL_HANDS } from "@/data/hands";
import { useWins } from "@/hooks/useWins";
import { useNotes } from "@/hooks/useNotes";
import { StatsBar } from "@/components/StatsBar";
import { FilterBar } from "@/components/FilterBar";
import { HandCard } from "@/components/HandCard";
import { StatsView } from "@/components/StatsView";
import { CalendarView } from "@/components/CalendarView";
import { RoundBar } from "@/components/RoundBar";
import { WinSheet } from "@/components/WinSheet";
import { winPoints, GAMES_PER_ROUND, localDayKey, roundsForDay } from "@/lib/stats";
import type { GameOutcome, Hand, HandFilter, PlayMode, WinOptions } from "@/lib/types";

// Per-device preferences (how you're playing, blanks for single games).
const MODE_KEY = "mahj_play_mode";
const SINGLE_BLANKS_KEY = "mahj_single_blanks";
function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

type View = "hands" | "stats" | "calendar";

const VIEW_LABEL: Record<View, string> = {
  hands: "🀙 Hands",
  stats: "📊 Stats",
  calendar: "📅 Calendar",
};

function handMatches(hand: Hand, sectionName: string, q: string): boolean {
  if (!q) return true;
  const haystack = (
    sectionName + " " + hand.description + " " + hand.pattern.map((p) => p.text).join(" ")
  ).toLowerCase();
  return haystack.includes(q);
}

export default function Home() {
  const {
    records,
    rounds,
    counts,
    loading,
    totalWins,
    playedCount,
    currentRound,
    nextRoundNumber,
    defaultBlanks,
    logWin,
    logLoss,
    logWall,
    startRound,
    setRoundBlanks,
    removeRound,
    setGameBlanks,
    undoWin,
    removeGame,
    status,
    errorMsg,
    reload,
  } = useWins();
  const { notes, setNote } = useNotes();
  const [view, setView] = useState<View>("hands");
  const [filter, setFilter] = useState<HandFilter>("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ label: string; undo?: () => void } | null>(null);
  const [winTarget, setWinTarget] = useState<{ hand: Hand; at?: Date } | null>(null);
  const [celebrate, setCelebrate] = useState<{ handId: string; key: number }>({ handId: "", key: 0 });

  // Blanks choice for a round that hasn't started yet (follows the last round's setting).
  const [pendingBlanks, setPendingBlanks] = useState(false);
  useEffect(() => {
    if (!currentRound) setPendingBlanks(defaultBlanks);
  }, [defaultBlanks, currentRound]);

  // Rounds vs single games, and blanks for single games — remembered per device.
  const [mode, setModeState] = useState<PlayMode>("rounds");
  const [singleBlanks, setSingleBlanksState] = useState(false);
  useEffect(() => {
    setModeState(readPref<PlayMode>(MODE_KEY, "rounds"));
    setSingleBlanksState(readPref<boolean>(SINGLE_BLANKS_KEY, false));
  }, []);
  const setMode = (m: PlayMode) => {
    setModeState(m);
    writePref(MODE_KEY, m);
  };
  const setSingleBlanks = (b: boolean) => {
    setSingleBlanksState(b);
    writePref(SINGLE_BLANKS_KEY, b);
  };
  const single = mode === "single";
  // Logging options for the current mode.
  const modeOpts = single
    ? { single: true, blanks: singleBlanks }
    : { newRoundBlanks: pendingBlanks };

  const todaySingles = useMemo(
    () => roundsForDay(localDayKey(new Date()), rounds, records).unassigned,
    [rounds, records],
  );

  const q = query.trim().toLowerCase();

  function showToast(label: string, undo?: () => void) {
    setToast({ label, undo });
    window.setTimeout(() => setToast((t) => (t?.label === label ? null : t)), 5000);
  }

  function undoLatest(outcome: GameOutcome) {
    const last = records
      .filter((r) => r.outcome === outcome)
      .sort((a, b) => (a.won_at < b.won_at ? 1 : -1))[0];
    if (last) removeGame(last);
  }

  function recordResult(kind: "loss" | "wall") {
    if (kind === "loss") logLoss(modeOpts);
    else logWall(modeOpts);
    showToast(kind === "loss" ? "Loss recorded" : "Wall game recorded", () => undoLatest(kind));
  }

  function confirmWin(opts: WinOptions) {
    if (!winTarget) return;
    const { hand, at } = winTarget;
    logWin(hand.id, {
      ...modeOpts,
      at,
      jokerless: opts.jokerless,
      selfDrawn: opts.selfDrawn,
    });
    setCelebrate((c) => ({ handId: hand.id, key: c.key + 1 }));
    const pts = winPoints(hand.id, opts).total;
    showToast(`Win logged · +${pts} pts`, () => undoWin(hand.id));
    setWinTarget(null);
  }

  const winRoundLabel = single
    ? `Single game · ${singleBlanks ? "Blanks" : "No blanks"}`
    : winTarget?.at
    ? "Adds to that day's round"
    : currentRound
      ? `Round ${currentRound.number} · Game ${currentRound.games.length + 1} of ${GAMES_PER_ROUND}`
      : `Starts Round ${nextRoundNumber}`;

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
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="paper-texture mx-auto min-h-dvh max-w-6xl px-4 pb-20 pt-6 sm:px-6">
      <WinSheet
        hand={winTarget?.hand ?? null}
        at={winTarget?.at}
        roundLabel={winRoundLabel}
        onConfirm={confirmWin}
        onClose={() => setWinTarget(null)}
      />

      {/* Transient confirmation toast with Undo */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-maroon-800 py-2 pl-4 pr-2 text-sm font-medium text-cream-50 shadow-lg"
          >
            <span>{toast.label}</span>
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
                className="rounded-full bg-cream-50/15 px-3 py-1 text-xs font-semibold hover:bg-cream-50/25"
              >
                Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Masthead */}
      <header className="flex flex-col items-center gap-5 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-3xl bg-maroon-700 px-6 pb-5 pt-6 text-cream-50 shadow-[0_10px_30px_rgba(52,8,17,0.18)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-cream-200/70">
            🀄 2026 NMJL card
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            The Mahj Journal
          </h1>
          <p className="mt-1 text-sm text-cream-100/75">Your hands, rounds &amp; wins.</p>

          {/* View switcher */}
          <div className="mt-4 inline-flex rounded-full bg-maroon-900/40 p-1">
            {(["hands", "stats", "calendar"] as View[]).map((v) => {
              const active = view === v;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="relative rounded-full px-4 py-1.5 text-sm font-semibold sm:px-5"
                >
                  {active && (
                    <motion.span
                      layoutId="view-pill"
                      className="absolute inset-0 rounded-full bg-cream-100"
                      transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    />
                  )}
                  <span className={`relative z-10 ${active ? "text-maroon-800" : "text-cream-100/80"}`}>
                    {VIEW_LABEL[v]}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        <p className="text-xs text-maroon-900/50">
          {status === "online"
            ? "✓ Synced to Supabase"
            : status === "loading"
              ? "Opening your journal…"
              : status === "offline"
                ? "Saved on this device (offline mode)"
                : "⚠️ Not connected"}
        </p>
      </header>

      {/* Connection error banner — makes clear data isn't lost, offers retry */}
      <AnimatePresence>
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto mt-4 max-w-2xl rounded-2xl bg-outcome-wall-soft p-4 text-center ring-1 ring-outcome-wall/40"
          >
            <p className="font-semibold text-outcome-wall-ink">
              Couldn&apos;t reach your saved data — but it&apos;s not lost.
            </p>
            <p className="mt-1 text-sm text-outcome-wall-ink/80">
              Your games are safe in Supabase; this is just a connection issue.
            </p>
            {errorMsg && <p className="mt-1 text-xs text-outcome-wall-ink/60">({errorMsg})</p>}
            <button
              onClick={reload}
              className="mt-3 rounded-full bg-maroon-700 px-4 py-1.5 text-sm font-semibold text-cream-50 hover:bg-maroon-800"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      {loading ? (
        <div className="mt-20 text-center font-display text-maroon-900/50">Opening your journal…</div>
      ) : view === "stats" ? (
        <StatsView records={records} rounds={rounds} removeGame={removeGame} />
      ) : view === "calendar" ? (
        <CalendarView
          records={records}
          rounds={rounds}
          mode={mode}
          onMode={setMode}
          singleBlanks={singleBlanks}
          onSingleBlanks={setSingleBlanks}
          setGameBlanks={setGameBlanks}
          defaultBlanks={defaultBlanks}
          removeGame={removeGame}
          removeRound={removeRound}
          setRoundBlanks={setRoundBlanks}
          startRound={startRound}
          logLoss={logLoss}
          logWall={logWall}
          onRequestWin={(hand, at) => setWinTarget({ hand, at })}
        />
      ) : (
        <>
          <div className="mt-5 flex flex-col items-center gap-5">
            <RoundBar
              mode={mode}
              onMode={setMode}
              currentRound={currentRound}
              nextRoundNumber={nextRoundNumber}
              pendingBlanks={pendingBlanks}
              onPendingBlanks={setPendingBlanks}
              onToggleBlanks={setRoundBlanks}
              onNewRound={() => startRound({ blanks: currentRound?.round.blanks ?? pendingBlanks })}
              singleBlanks={singleBlanks}
              onSingleBlanks={setSingleBlanks}
              todaySingles={todaySingles}
              onLoss={() => recordResult("loss")}
              onWall={() => recordResult("wall")}
            />
            <StatsBar totalHands={ALL_HANDS.length} playedCount={playedCount} totalWins={totalWins} />
          </div>

          {/* Controls */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <FilterBar value={filter} onChange={setFilter} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search hands…"
                className="w-56 rounded-full border border-maroon-900/15 bg-cream-50 px-4 py-2 text-sm text-maroon-900 placeholder:text-maroon-900/40 outline-none focus:border-maroon-500"
              />
            </div>

            {/* Section quick-nav */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => jumpTo(s.id)}
                  className="rounded-full bg-cream-50 px-2.5 py-1 text-xs font-medium text-maroon-800/80 ring-1 ring-maroon-900/10 transition-colors hover:bg-maroon-700 hover:text-cream-50"
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
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="font-display text-2xl font-bold text-maroon-700">{section.name}</h2>
                    <span className="h-px flex-1 bg-maroon-900/15" />
                  </div>
                  <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {section.hands.map((hand) => (
                        <HandCard
                          key={hand.id}
                          hand={hand}
                          winCount={counts[hand.id] ?? 0}
                          note={notes[hand.id] ?? ""}
                          celebrateKey={celebrate.handId === hand.id ? celebrate.key : 0}
                          onRequestWin={(h) => setWinTarget({ hand: h })}
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
              <div className="mt-20 text-center text-maroon-900/50">No hands match this filter.</div>
            )}
          </div>
        </>
      )}

      <footer className="mt-16 text-center text-xs text-maroon-900/40">
        The Mahj Journal · 2026 National Mah Jongg League card · {ALL_HANDS.length} hands · made
        for Lottie 🀄
      </footer>
    </main>
  );
}
