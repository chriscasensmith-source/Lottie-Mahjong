"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { SECTIONS, ALL_HANDS, CARD_YEAR } from "@/data/hands";
import { useWins, type LogOptions } from "@/hooks/useWins";
import { useNotes } from "@/hooks/useNotes";
import { useFavorites } from "@/hooks/useFavorites";
import { FilterBar } from "@/components/FilterBar";
import { HandCard } from "@/components/HandCard";
import { StatsView } from "@/components/StatsView";
import { CalendarView } from "@/components/CalendarView";
import { RoundBar } from "@/components/RoundBar";
import { WinSheet } from "@/components/WinSheet";
import { CardChallenge } from "@/components/CardChallenge";
import { RecapSheet } from "@/components/RecapSheet";
import {
  GAMES_PER_ROUND,
  cardProgress,
  cardYearRecords,
  dayRecap,
  localDayKey,
  outcomeTotals,
  recentlyWonHands,
  sectionStats,
  roundsForDay,
  winMilestone,
  winPoints,
} from "@/lib/stats";
import type { GameRecord, Hand, HandFilter, PlayMode, WinOptions } from "@/lib/types";

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
const VIEWS: { key: View; label: string; icon: string }[] = [
  { key: "hands", label: "Hands", icon: "🀙" },
  { key: "stats", label: "Stats", icon: "📊" },
  { key: "calendar", label: "Calendar", icon: "📅" },
];

// Taps on the same log button closer together than this are treated as one.
const DOUBLE_TAP_MS = 700;

interface Toast {
  id: number;
  label: string;
  detail?: string;
  tone?: "default" | "celebrate";
  undo?: () => void;
}

function handMatches(hand: Hand, sectionName: string, q: string): boolean {
  if (!q) return true;
  const haystack = (
    sectionName + " " + hand.description + " " + hand.pattern.map((p) => p.text).join(" ")
  ).toLowerCase();
  return haystack.includes(q);
}

export default function Home() {
  const wins = useWins();
  const {
    records,
    rounds,
    counts,
    loading,
    todayRound,
    currentRound,
    nextRoundNumber,
    defaultBlanks,
    logWin,
    logLoss,
    logWall,
    setRoundBlanks,
    endRound,
    removeRound,
    setGameBlanks,
    undoWin,
    removeGame,
    status,
    saveState,
    errorMsg,
    reload,
    retrySaves,
    clearError,
  } = wins;
  const { notes, setNote } = useNotes();
  const { favorites, toggleFavorite } = useFavorites();
  const [view, setView] = useState<View>("hands");
  const [filter, setFilter] = useState<HandFilter>("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [winTarget, setWinTarget] = useState<{ hand: Hand; opts?: LogOptions; label?: string } | null>(null);
  const [celebrate, setCelebrate] = useState<{ handId: string; key: number }>({ handId: "", key: 0 });
  const [recapDay, setRecapDay] = useState<string | null>(null);

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
  const modeOpts: LogOptions = single ? { single: true, blanks: singleBlanks } : { newRoundBlanks: pendingBlanks };

  // ---- derived ---------------------------------------------------------------
  const cardRecords = useMemo(() => cardYearRecords(records), [records]);
  const progress = useMemo(() => cardProgress(cardRecords), [cardRecords]);
  const sectionStatsList = useMemo(() => sectionStats(cardRecords), [cardRecords]);
  const handStats = useMemo(() => recentlyWonHands(cardRecords, ALL_HANDS.length), [cardRecords]);
  const lastWonById = useMemo(() => new Map(handStats.map((h) => [h.hand.id, h.lastWon])), [handStats]);
  const todayKey = localDayKey(new Date());
  const todayDay = useMemo(() => roundsForDay(todayKey, rounds, records), [todayKey, rounds, records]);
  const todayTotals = useMemo(
    () => outcomeTotals(records.filter((r) => localDayKey(new Date(r.won_at)) === todayKey)),
    [records, todayKey],
  );
  const recap = useMemo(() => (recapDay ? dayRecap(recapDay, records, rounds) : null), [recapDay, records, rounds]);

  // ---- toasts ----------------------------------------------------------------
  const toastId = useRef(0);
  const showToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToast({ ...t, id });
    window.setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), t.tone === "celebrate" ? 7000 : 5500);
  }, []);

  // Did this game just fill the 4th slot of today's round?
  function roundNote(opts: LogOptions, record: GameRecord | null): string | undefined {
    if (!record?.round_id || opts.at) return undefined;
    const before = currentRound && currentRound.round.id === record.round_id ? currentRound.games : [];
    if (before.length + 1 !== GAMES_PER_ROUND) return `Round ${currentRound?.number ?? nextRoundNumber} · ${before.length + 1} of ${GAMES_PER_ROUND}`;
    const w = [...before, record].filter((g) => g.outcome === "win").length;
    return `Round ${currentRound!.number} complete · ${w} win${w === 1 ? "" : "s"} in ${GAMES_PER_ROUND} games`;
  }

  // ---- logging ---------------------------------------------------------------
  const lastTap = useRef<Record<string, number>>({});
  function tooSoon(key: string) {
    const now = Date.now();
    if (now - (lastTap.current[key] ?? 0) < DOUBLE_TAP_MS) return true;
    lastTap.current[key] = now;
    return false;
  }

  function recordResult(kind: "loss" | "wall") {
    if (tooSoon(kind)) return;
    const record = kind === "loss" ? logLoss(modeOpts) : logWall(modeOpts);
    if (!record) return;
    showToast({
      label: kind === "loss" ? "Loss recorded" : "Wall game recorded",
      detail: roundNote(modeOpts, record),
      undo: () => removeGame(record),
    });
  }

  function requestWin(hand: Hand, opts?: LogOptions, label?: string) {
    setWinTarget({ hand, opts, label });
  }

  // The sheet stays on screen while it animates out, so a fast double-tap can
  // reach a stale confirm. Each request may be confirmed exactly once.
  const confirmed = useRef<object | null>(null);
  function confirmWin(choice: WinOptions) {
    if (!winTarget || confirmed.current === winTarget) return;
    confirmed.current = winTarget;
    const { hand } = winTarget;
    const opts: LogOptions = { ...(winTarget.opts ?? modeOpts), jokerless: choice.jokerless, selfDrawn: choice.selfDrawn };
    setWinTarget(null);
    const milestone = winMilestone(cardRecords, hand.id);
    const record = logWin(hand.id, opts);
    if (!record) return;
    setCelebrate((c) => ({ handId: hand.id, key: c.key + 1 }));
    const pts = winPoints(hand.id, choice).total;
    const undo = () => removeGame(record);
    const rn = roundNote(opts, record);

    if (milestone.cardComplete) {
      showToast({ tone: "celebrate", label: `🎉 Every hand on the ${CARD_YEAR} card won!`, detail: `+${pts} pts`, undo });
    } else if (milestone.sectionComplete) {
      showToast({ tone: "celebrate", label: `🎉 ${milestone.sectionComplete} complete!`, detail: `Every hand in the section won · ${milestone.uniqueAfter} of ${ALL_HANDS.length}`, undo });
    } else if (milestone.milestone) {
      showToast({ tone: "celebrate", label: `✨ ${milestone.milestone} unique hand${milestone.milestone === 1 ? "" : "s"} won!`, detail: `+${pts} pts`, undo });
    } else if (milestone.firstForHand) {
      showToast({ tone: "celebrate", label: "✨ First win with this hand", detail: `${milestone.uniqueAfter} of ${ALL_HANDS.length} unique hands · +${pts} pts`, undo });
    } else {
      showToast({ label: `Win logged · +${pts} pts`, detail: rn, undo });
    }
  }

  const winRoundLabel = winTarget?.label
    ? winTarget.label
    : single
      ? `Single game · ${singleBlanks ? "Blanks" : "No blanks"}`
      : currentRound
        ? `Round ${currentRound.number} · Game ${currentRound.games.length + 1} of ${GAMES_PER_ROUND}`
        : `Starts Round ${nextRoundNumber}`;

  // ---- hands list ------------------------------------------------------------
  const q = query.trim().toLowerCase();
  const recentIds = useMemo(() => handStats.slice(0, 12).map((h) => h.hand.id), [handStats]);
  const filterCounts = {
    all: ALL_HANDS.length,
    won: progress.won,
    unwon: progress.remaining,
    favorites: favorites.size,
  };

  const sections = useMemo(() => {
    if (filter === "recent") {
      const hands = recentIds
        .map((id) => ALL_HANDS.find((h) => h.id === id)!)
        .filter((h) => handMatches(h, h.sectionId, q));
      return hands.length ? [{ id: "recent", name: "Recently won", note: "Newest win first", accentClass: "", hands }] : [];
    }
    return SECTIONS.map((section) => {
      const hands = section.hands.filter((hand) => {
        const won = (counts[hand.id] ?? 0) > 0;
        if (filter === "won" && !won) return false;
        if (filter === "unwon" && won) return false;
        if (filter === "favorites" && !favorites.has(hand.id)) return false;
        return handMatches(hand, section.name, q);
      });
      return { ...section, hands };
    }).filter((section) => section.hands.length > 0);
  }, [counts, filter, q, favorites, recentIds]);

  const sectionProgress = useMemo(
    () =>
      new Map(
        SECTIONS.map((s) => [s.id, { won: s.hands.filter((h) => (counts[h.id] ?? 0) > 0).length, total: s.hands.length }]),
      ),
    [counts],
  );

  function jumpTo(id: string) {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ block: "start" });
  }

  // ---- render ------------------------------------------------------------------
  // Couldn't load and nothing on screen yet: don't show zeros that look like lost data.
  const noData = status === "error" && records.length === 0;
  const saveLine =
    status === "offline"
      ? { text: "Saved on this device", tone: "muted" }
      : status === "loading"
        ? { text: "Connecting…", tone: "muted" }
        : saveState === "error"
          ? { text: "Couldn't save.", tone: "error" }
          : saveState === "saving"
            ? { text: "Saving…", tone: "muted" }
            : status === "error"
              ? { text: "Not connected", tone: "error" }
              : { text: "✓ All changes saved", tone: "ok" };

  return (
    <MotionConfig reducedMotion="user">
      <main className="paper-texture mx-auto min-h-dvh max-w-6xl px-4 pb-24 pt-3 sm:px-6 sm:pt-5">
        <WinSheet
          hand={winTarget?.hand ?? null}
          at={winTarget?.opts?.at}
          roundLabel={winRoundLabel}
          onConfirm={confirmWin}
          onClose={() => setWinTarget(null)}
        />
        <RecapSheet dayKey={recapDay} recap={recap} onClose={() => setRecapDay(null)} />

        {/* Toast with Undo */}
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" aria-live="polite">
          <AnimatePresence mode="wait">
            {toast && (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
                className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl py-2.5 pl-4 pr-2 text-cream-50 shadow-lg ${
                  toast.tone === "celebrate" ? "bg-maroon-800 ring-2 ring-gold" : "bg-maroon-800"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{toast.label}</p>
                  {toast.detail && <p className="text-xs text-cream-100/85">{toast.detail}</p>}
                </div>
                {toast.undo && (
                  <button
                    onClick={() => {
                      toast.undo?.();
                      setToast(null);
                    }}
                    className="min-h-10 shrink-0 rounded-full bg-cream-50/15 px-4 text-sm font-semibold hover:bg-cream-50/25"
                  >
                    Undo
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Masthead (compact) */}
        <header className="rounded-3xl bg-maroon-700 px-4 pb-3 pt-3.5 text-center text-cream-50 shadow-[0_8px_24px_rgba(52,8,17,0.16)] sm:px-6 sm:pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cream-200/85">
            🀄 {CARD_YEAR} NMJL card
          </p>
          <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">
            The Mahj Journal
          </h1>
          <p className="text-xs text-cream-100/85 sm:text-sm">Your hands, rounds &amp; wins.</p>

          <nav aria-label="Sections" className="mx-auto mt-2.5 grid max-w-sm grid-cols-3 rounded-full bg-maroon-900/40 p-1">
            {VIEWS.map((v) => {
              const active = view === v.key;
              return (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  aria-current={active ? "page" : undefined}
                  className="relative min-h-10 rounded-full px-2 text-sm font-semibold"
                >
                  {active && (
                    <motion.span
                      layoutId="view-pill"
                      className="absolute inset-0 rounded-full bg-cream-100"
                      transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    />
                  )}
                  <span className={`relative z-10 ${active ? "text-maroon-800" : "text-cream-50"}`}>
                    <span aria-hidden>{v.icon} </span>
                    {v.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </header>

        {/* Save status */}
        <div className="mt-2 flex min-h-6 items-center justify-end gap-2 px-1 text-xs" role="status" aria-live="polite">
          <span
            className={
              saveLine.tone === "error"
                ? "font-semibold text-tile-red"
                : saveLine.tone === "ok"
                  ? "text-outcome-win-ink"
                  : "text-maroon-900/75"
            }
          >
            {saveLine.text}
          </span>
          {saveState === "error" && (
            <button onClick={retrySaves} className="font-semibold text-maroon-700 underline underline-offset-2">
              Retry
            </button>
          )}
        </div>

        {/* A change the database refused (e.g. a full round) */}
        {errorMsg && saveState === "saved" && status === "online" && (
          <div className="mx-auto mt-1 flex max-w-2xl items-center justify-between gap-3 rounded-2xl bg-outcome-wall-soft px-4 py-2 text-sm text-outcome-wall-ink ring-1 ring-outcome-wall/40">
            <span>{errorMsg}</span>
            <button onClick={clearError} className="shrink-0 text-xs font-semibold underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Couldn't load at all — make clear nothing is lost */}
        <AnimatePresence>
          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-auto mt-2 max-w-2xl rounded-2xl bg-outcome-wall-soft p-4 text-center ring-1 ring-outcome-wall/40"
            >
              <p className="font-semibold text-outcome-wall-ink">Couldn&apos;t open your journal right now. Your games are safe.</p>
              <p className="mt-1 text-sm text-outcome-wall-ink">This is just a connection problem. Try again in a moment.</p>
              <button
                onClick={() => void reload()}
                className="mt-3 min-h-10 rounded-full bg-maroon-700 px-5 text-sm font-semibold text-cream-50 hover:bg-maroon-800"
              >
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Body */}
        {loading ? (
          <div className="mt-20 text-center font-display text-maroon-900/70">Opening your journal…</div>
        ) : noData && view !== "hands" ? (
          <p className="mt-10 text-center text-sm text-maroon-900/75">
            Your {view === "stats" ? "stats" : "calendar"} will appear as soon as the journal opens.
          </p>
        ) : view === "stats" ? (
          <StatsView records={records} rounds={rounds} removeGame={removeGame} />
        ) : view === "calendar" ? (
          <CalendarView
            records={records}
            rounds={rounds}
            singleBlanks={singleBlanks}
            onSingleBlanks={setSingleBlanks}
            defaultBlanks={defaultBlanks}
            setGameBlanks={setGameBlanks}
            removeGame={removeGame}
            removeRound={removeRound}
            endRound={endRound}
            setRoundBlanks={setRoundBlanks}
            onLog={(kind, opts) => {
              const record = kind === "loss" ? logLoss(opts) : logWall(opts);
              if (record)
                showToast({ label: kind === "loss" ? "Loss added" : "Wall game added", undo: () => removeGame(record) });
            }}
            onRequestWin={requestWin}
            onRecap={setRecapDay}
          />
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <RoundBar
                mode={mode}
                onMode={setMode}
                todayRound={todayRound}
                currentRound={currentRound}
                nextRoundNumber={nextRoundNumber}
                pendingBlanks={pendingBlanks}
                onPendingBlanks={setPendingBlanks}
                onToggleBlanks={setRoundBlanks}
                onEndRound={endRound}
                singleBlanks={singleBlanks}
                onSingleBlanks={setSingleBlanks}
                todaySingles={todayDay.unassigned}
                today={todayTotals}
                quickHands={handStats.slice(0, 8)}
                onQuickWin={(h) => requestWin(h)}
                onLoss={() => recordResult("loss")}
                onWall={() => recordResult("wall")}
                onRecap={() => setRecapDay(todayKey)}
              />
              {!noData && <CardChallenge progress={progress} totalWins={cardRecords.filter((r) => r.outcome === "win").length}
                sections={sectionStatsList}
              />}
            </div>

            {/* Controls */}
            <div className="mt-6 flex flex-col gap-3 sm:items-center">
              <FilterBar value={filter} onChange={setFilter} counts={filterCounts} />
              <label className="sr-only" htmlFor="hand-search">
                Search hands
              </label>
              <input
                id="hand-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search hands, e.g. 2468 or NEWS"
                className="min-h-11 w-full rounded-full border border-maroon-900/20 bg-cream-50 px-4 text-base text-maroon-900 outline-none placeholder:text-maroon-900/55 focus:border-maroon-500 sm:w-80 sm:text-sm"
              />
              {filter !== "recent" && (
                <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
                  {sections.map((s) => {
                    const p = sectionProgress.get(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => jumpTo(s.id)}
                        className="min-h-9 shrink-0 whitespace-nowrap rounded-full bg-cream-50 px-3 text-xs font-semibold text-maroon-800 ring-1 ring-maroon-900/15 transition-colors hover:bg-maroon-700 hover:text-cream-50"
                      >
                        {s.name}
                        {p && (
                          <span className="ml-1 font-normal tabular-nums opacity-80">
                            {p.won}/{p.total}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 space-y-8">
              {sections.map((section) => {
                const p = sectionProgress.get(section.id);
                return (
                  <section key={section.id} id={`sec-${section.id}`} className="scroll-mt-4" aria-label={section.name}>
                    <div className="mb-3 flex items-center gap-3">
                      <h2 className="font-display text-2xl font-bold text-maroon-700">{section.name}</h2>
                      {p && (
                        <span className="text-sm text-maroon-900/75">
                          {p.won} of {p.total} won{p.won === p.total ? " ✓" : ""}
                        </span>
                      )}
                      <span className="h-px flex-1 bg-maroon-900/15" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {section.hands.map((hand) => (
                        <HandCard
                          key={hand.id}
                          hand={hand}
                          winCount={counts[hand.id] ?? 0}
                          lastWon={lastWonById.get(hand.id)}
                          note={notes[hand.id] ?? ""}
                          favorite={favorites.has(hand.id)}
                          celebrateKey={celebrate.handId === hand.id ? celebrate.key : 0}
                          onRequestWin={(h) => requestWin(h)}
                          onUndo={undoWin}
                          onNoteChange={setNote}
                          onToggleFavorite={toggleFavorite}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}

              {sections.length === 0 && (
                <div className="mt-12 text-center text-maroon-900/75">
                  {filter === "favorites" && !q
                    ? "No favorites yet. Tap ☆ on any hand to add it here."
                    : filter === "recent" && !q
                      ? "No wins logged yet."
                      : "No hands match this filter."}
                </div>
              )}
            </div>
          </>
        )}

        <footer className="mt-16 text-center text-xs text-maroon-900/70">
          The Mahj Journal · {CARD_YEAR} National Mah Jongg League card · {ALL_HANDS.length} hands · made for Lottie 🀄
        </footer>
      </main>
    </MotionConfig>
  );
}
