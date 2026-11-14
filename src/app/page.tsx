"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { EntrySheet, type EntryContext, type EntryRequest, type EntryResult } from "@/components/EntrySheet";
import { CardChallenge } from "@/components/CardChallenge";
import { RecapSheet } from "@/components/RecapSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoginScreen } from "@/components/LoginScreen";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  DISCARD_PENALTY,
  GAMES_PER_ROUND,
  cardProgress,
  gamePoints,
  handById,
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
import type { GameOutcome, GameRecord, Hand, HandFilter, PlayMode } from "@/lib/types";

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

interface Toast {
  id: number;
  label: string;
  detail?: string;
  tone?: "default" | "celebrate";
  undo?: () => void;
}

const FULL_DATE: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" };

// "Win · 2468 · Oct 31, 7:42 PM" — what the delete dialog is about to remove.
function describeGame(g: GameRecord): string {
  const when = new Date(g.won_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const hand = g.hand_id ? handById(g.hand_id) : null;
  const what =
    g.outcome === "win" ? `Win${hand ? ` · ${hand.pattern.map((p) => p.text).join(" ")}` : ""}` : g.outcome === "loss" ? "Loss" : "Wall game";
  const pts = gamePoints(g);
  return `${what}${pts ? ` (${pts > 0 ? "+" : ""}${pts} pts)` : ""} · ${when}`;
}

function handMatches(hand: Hand, sectionName: string, q: string): boolean {
  if (!q) return true;
  const haystack = (
    sectionName + " " + hand.description + " " + hand.pattern.map((p) => p.text).join(" ")
  ).toLowerCase();
  return haystack.includes(q);
}

// The front door. With a database configured, you sign in first and get your
// own journal. Without one (local runs), the journal lives on this device.
export default function Home() {
  const auth = useAuth();
  if (!isSupabaseConfigured) return <Journal />;
  if (!auth.ready) {
    return (
      <main className="paper-texture flex min-h-dvh items-center justify-center font-display text-maroon-900/70">
        Opening your diary…
      </main>
    );
  }
  if (!auth.user) return <LoginScreen sendCode={auth.sendCode} verifyCode={auth.verifyCode} />;
  // The key gives each person a completely fresh journal: nothing carries over
  // in memory when someone else signs in on the same device.
  return <Journal key={auth.user.id} email={auth.user.email} onSignOut={auth.signOut} />;
}

function Journal({ email, onSignOut }: { email?: string; onSignOut?: () => Promise<void> }) {
  const wins = useWins();
  const {
    records,
    rounds,
    counts,
    loading,
    todayRound,
    currentRound,
    nextRoundNumber,
    logWin,
    logLoss,
    logWall,
    endRound,
    removeRound,
    setGameBlanks,
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
  const [view, setViewState] = useState<View>("hands");
  const [filter, setFilter] = useState<HandFilter>("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [celebrate, setCelebrate] = useState<{ handId: string; key: number }>({ handId: "", key: 0 });
  const [recapDay, setRecapDay] = useState<string | null>(null);

  // The one entry sheet, and the options the saved game will use.
  const [entry, setEntry] = useState<(EntryRequest & { opts: LogOptions }) | null>(null);
  // Confirmations: nothing is deleted or changed without one.
  const [pendingDelete, setPendingDelete] = useState<GameRecord | null>(null);
  const [pendingEndRound, setPendingEndRound] = useState<string | null>(null);
  const [pendingBlanks, setPendingBlanks] = useState<{ game: GameRecord; blanks: boolean } | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // Scramble / single games / tournament, and blanks for single games — remembered per device.
  const [mode, setModeState] = useState<PlayMode>("scramble");
  const [singleBlanks, setSingleBlanksState] = useState(false);
  useEffect(() => {
    const saved = readPref<string>(MODE_KEY, "scramble");
    setModeState(saved === "single" || saved === "tournament" ? saved : "scramble"); // old "rounds" = scramble
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
  const modeOpts: LogOptions =
    mode === "single" ? { single: true, blanks: singleBlanks } : mode === "tournament" ? { tournament: true } : {};

  // Each screen keeps its place: switching tabs restores where you were.
  const scrollPos = useRef<Record<View, number>>({ hands: 0, stats: 0, calendar: 0 });
  function setView(next: View) {
    if (next === view) return;
    scrollPos.current[view] = window.scrollY;
    setViewState(next);
  }
  useLayoutEffect(() => {
    window.scrollTo(0, scrollPos.current[view]);
  }, [view]);

  // Hide the bottom tab bar while the on-screen keyboard is likely open.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && (t as HTMLInputElement).type !== "checkbox"));
    const onIn = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  // ---- derived ---------------------------------------------------------------
  const cardRecords = useMemo(() => cardYearRecords(records), [records]);
  const progress = useMemo(() => cardProgress(cardRecords), [cardRecords]);
  const sectionStatsList = useMemo(() => sectionStats(cardRecords), [cardRecords]);
  const handStats = useMemo(() => recentlyWonHands(cardRecords, ALL_HANDS.length), [cardRecords]);
  const lastWonById = useMemo(() => new Map(handStats.map((h) => [h.hand.id, h.lastWon])), [handStats]);
  const todayKey = localDayKey(new Date());
  const todayDay = useMemo(() => roundsForDay(todayKey, rounds, records), [todayKey, rounds, records]);
  const todayGames = useMemo(
    () =>
      records
        .filter((r) => localDayKey(new Date(r.won_at)) === todayKey)
        .sort((a, b) => (a.won_at < b.won_at ? -1 : 1)),
    [records, todayKey],
  );
  const todayTotals = useMemo(() => outcomeTotals(todayGames), [todayGames]);
  const todaySingles = useMemo(() => todayDay.unassigned.filter((g) => !g.tournament), [todayDay]);
  const todayTournament = useMemo(() => todayGames.filter((g) => g.tournament), [todayGames]);
  const recap = useMemo(() => (recapDay ? dayRecap(recapDay, records, rounds) : null), [recapDay, records, rounds]);
  const recentHands = useMemo(() => handStats.slice(0, 5).map((h) => h.hand), [handStats]);
  const favoriteHands = useMemo(() => ALL_HANDS.filter((h) => favorites.has(h.id)), [favorites]);

  // ---- toasts ----------------------------------------------------------------
  const toastId = useRef(0);
  const showToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToast({ ...t, id });
    window.setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), t.tone === "celebrate" ? 9000 : 8000);
  }, []);

  // ---- logging ---------------------------------------------------------------

  // Where a game with these options will go: its date, mode and round.
  function contextFor(opts: LogOptions): EntryContext {
    const at = opts.at ?? new Date();
    const dayKey = localDayKey(at);
    const base = { dateLabel: at.toLocaleDateString(undefined, FULL_DATE), isToday: dayKey === todayKey };
    if (opts.tournament) return { ...base, modeLabel: "Tournament", roundLabel: null, tournament: true };
    if (opts.single) {
      return { ...base, modeLabel: `Single game · ${opts.blanks ? "with blanks" : "no blanks"}`, roundLabel: null, tournament: false };
    }
    const day = roundsForDay(dayKey, rounds, records);
    let roundLabel: string;
    const target = opts.roundId
      ? day.rounds.find((r) => r.round.id === opts.roundId)
      : opts.newRound
        ? undefined
        : day.rounds[day.rounds.length - 1]?.status === "open"
          ? day.rounds[day.rounds.length - 1]
          : undefined;
    if (target) roundLabel = `Round ${target.number} · Game ${target.games.length + 1} of ${GAMES_PER_ROUND}`;
    else roundLabel = `Starts Round ${day.rounds.length + 1} · Game 1 of ${GAMES_PER_ROUND}`;
    return { ...base, modeLabel: "Scramble", roundLabel, tournament: false };
  }

  // Opening the sheet saves nothing. A game (and, if needed, its round) is
  // only created when Save is tapped.
  function openEntry(outcome: GameOutcome, opts: LogOptions = modeOpts, hand?: Hand) {
    setEntry({ outcome, hand, opts, context: contextFor(opts) });
  }

  // The sheet stays on screen while it animates out, so a fast double tap can
  // reach a stale Save. Each request may be saved exactly once.
  const savedRequest = useRef<object | null>(null);
  function saveEntry(result: EntryResult) {
    if (!entry || savedRequest.current === entry) return;
    savedRequest.current = entry;
    const base = entry.opts;
    const ctx = entry.context;
    setEntry(null);
    const where = ctx.roundLabel ? ctx.roundLabel.replace(/^Starts /, "") : ctx.modeLabel;
    const detail = ctx.isToday ? where : `${ctx.dateLabel} · ${where}`;

    if (result.outcome === "win" && result.hand) {
      const hand = result.hand;
      const milestone = winMilestone(cardRecords, hand.id);
      const record = logWin(hand.id, { ...base, jokerless: result.jokerless, selfDrawn: result.selfDrawn });
      if (!record) return;
      setCelebrate((c) => ({ handId: hand.id, key: c.key + 1 }));
      const pts = winPoints(hand.id, result).total;
      const undo = () => removeGame(record);
      if (milestone.cardComplete) {
        showToast({ tone: "celebrate", label: `🎉 Every hand on the ${CARD_YEAR} card won!`, detail: `+${pts} points`, undo });
      } else if (milestone.sectionComplete) {
        showToast({ tone: "celebrate", label: `🎉 ${milestone.sectionComplete} complete!`, detail: `Every hand in the section won · ${milestone.uniqueAfter} of ${ALL_HANDS.length}`, undo });
      } else if (milestone.milestone) {
        showToast({ tone: "celebrate", label: `✨ ${milestone.milestone} unique hand${milestone.milestone === 1 ? "" : "s"} won!`, detail: `+${pts} points`, undo });
      } else if (milestone.firstForHand) {
        showToast({ tone: "celebrate", label: "✨ First win with this hand", detail: `${milestone.uniqueAfter} of ${ALL_HANDS.length} unique hands · +${pts} points`, undo });
      } else {
        showToast({ label: `Win · +${pts} points`, detail, undo });
      }
      return;
    }

    const record =
      result.outcome === "wall" ? logWall(base) : logLoss({ ...base, discardedWinner: result.discardedWinner });
    if (!record) return;
    showToast({
      label: result.outcome === "wall" ? "Wall game" : result.discardedWinner ? `Loss · −${DISCARD_PENALTY} points` : "Loss",
      detail,
      undo: () => removeGame(record),
    });
  }

  // Every delete goes through "Are you sure?" first.
  function askDelete(game: GameRecord) {
    setPendingDelete(game);
  }
  function askDeleteLastWin(handId: string) {
    const last = records
      .filter((r) => r.hand_id === handId && r.outcome === "win")
      .sort((a, b) => (a.won_at < b.won_at ? 1 : -1))[0];
    if (last) setPendingDelete(last);
  }
  const endingCount = pendingEndRound ? records.filter((g) => g.round_id === pendingEndRound).length : 0;

  // ---- hands list ------------------------------------------------------------
  const q = query.trim().toLowerCase();
  const recentIds = useMemo(() => handStats.slice(0, 12).map((h) => h.hand.id), [handStats]);
  const filterCounts = {
    all: ALL_HANDS.length,
    won: progress.won,
    unwon: progress.remaining,
    favorites: favorites.size,
    recent: recentIds.length,
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
  const shownCount = sections.reduce((n, s) => n + s.hands.length, 0);
  const filtered = filter !== "all" || q !== "";
  function resetFilters() {
    setFilter("all");
    setQuery("");
  }

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
  // The database said "not allowed" rather than "can't reach me".
  const denied = status === "error" && /permission|jwt|not authorized|denied|401/i.test(errorMsg ?? "");
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
  // The same truth, phrased for the toast that follows a new game.
  const toastSave =
    status === "offline" ? "Saved on this device" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved yet. Tap Retry at the top." : "Saved ✓";

  const navButton = (v: (typeof VIEWS)[number], variant: "top" | "bottom") => {
    const active = view === v.key;
    return variant === "top" ? (
      <button
        key={v.key}
        onClick={() => setView(v.key)}
        aria-current={active ? "page" : undefined}
        className={`min-h-11 rounded-full px-2 text-base font-semibold transition-colors ${
          active ? "bg-cream-100 text-maroon-800" : "text-cream-50 hover:bg-maroon-900/30"
        }`}
      >
        <span aria-hidden>{v.icon} </span>
        {v.label}
      </button>
    ) : (
      <button
        key={v.key}
        onClick={() => setView(v.key)}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-[3px] text-sm font-semibold ${
          active ? "border-maroon-700 bg-maroon-50 text-maroon-800" : "border-transparent text-maroon-900/80"
        }`}
      >
        <span aria-hidden className="text-lg leading-none">
          {v.icon}
        </span>
        <span className={active ? "underline decoration-2 underline-offset-4" : ""}>{v.label}</span>
      </button>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="paper-texture mx-auto min-h-dvh max-w-6xl px-3 pb-28 pt-2 sm:px-6 sm:pb-16 sm:pt-5">
        {/* Masthead: short on a phone, where the tabs live at the bottom */}
        <header className="rounded-2xl bg-maroon-700 px-4 py-2.5 text-center text-cream-50 shadow-[0_8px_24px_rgba(52,8,17,0.16)] sm:rounded-3xl sm:px-6 sm:py-4">
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-4xl">My Mahj Diary</h1>
          <p className="text-sm text-cream-100/90">
            Your hands, rounds &amp; wins. <span className="whitespace-nowrap">🀄 {CARD_YEAR} NMJL card</span>
          </p>
          <nav aria-label="Main" className="mx-auto mt-2.5 hidden max-w-sm grid-cols-3 gap-1 rounded-full bg-maroon-900/40 p-1 sm:grid">
            {VIEWS.map((v) => navButton(v, "top"))}
          </nav>
        </header>

        {/* Save status */}
        <div className="mt-1.5 flex min-h-7 items-center justify-end gap-2 px-1 text-sm" role="status" aria-live="polite">
          <span
            className={
              saveLine.tone === "error"
                ? "font-semibold text-tile-red"
                : saveLine.tone === "ok"
                  ? "text-outcome-win-ink"
                  : "text-maroon-900/80"
            }
          >
            {saveLine.text}
          </span>
          {saveState === "error" && (
            <button onClick={retrySaves} className="min-h-11 px-1 font-semibold text-maroon-700 underline underline-offset-2">
              Retry
            </button>
          )}
        </div>

        {/* A change the database refused (e.g. a full round) */}
        {errorMsg && saveState === "saved" && status === "online" && (
          <div role="alert" className="mx-auto mt-1 flex max-w-2xl items-center justify-between gap-3 rounded-2xl bg-outcome-wall-soft px-4 py-2 text-base text-outcome-wall-ink ring-1 ring-outcome-wall/40">
            <span>{errorMsg}</span>
            <button onClick={clearError} className="min-h-11 shrink-0 px-1 text-sm font-semibold underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Couldn't load at all — make clear nothing is lost */}
        {status === "error" && (
          <div role="alert" className="mx-auto mt-2 max-w-2xl rounded-2xl bg-outcome-wall-soft p-4 text-center ring-1 ring-outcome-wall/40">
            {denied ? (
              <>
                <p className="text-lg font-semibold text-outcome-wall-ink">You&apos;ve been signed out. Your games are safe.</p>
                <p className="mt-1 text-base text-outcome-wall-ink">Sign in again to open your diary.</p>
                {onSignOut && (
                  <button
                    onClick={() => void onSignOut()}
                    className="mt-3 min-h-12 rounded-full bg-maroon-700 px-5 text-base font-semibold text-cream-50 hover:bg-maroon-800"
                  >
                    Sign in again
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-outcome-wall-ink">Couldn&apos;t open your diary right now. Your games are safe.</p>
                <p className="mt-1 text-base text-outcome-wall-ink">This is a connection problem, not an empty diary. Try again in a moment.</p>
                <button
                  onClick={() => void reload()}
                  className="mt-3 min-h-12 rounded-full bg-maroon-700 px-5 text-base font-semibold text-cream-50 hover:bg-maroon-800"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        )}

        <main>
          {loading ? (
            <div className="mt-20 text-center font-display text-lg text-maroon-900/75" role="status">
              Opening your diary…
            </div>
          ) : (
            <>
              {/* All three screens stay mounted, so each keeps its state (selected day, chart view, filters). */}
              <div hidden={view !== "stats"}>
                {noData ? (
                  <p className="mt-10 text-center text-base text-maroon-900/80">Your stats will appear as soon as your diary opens.</p>
                ) : (
                  <StatsView
                    records={records}
                    rounds={rounds}
                    removeGame={askDelete}
                    onStartTournament={() => {
                      setMode("tournament");
                      setView("hands");
                    }}
                    onGoToHands={() => setView("hands")}
                  />
                )}
              </div>

              <div hidden={view !== "calendar"}>
                {noData ? (
                  <p className="mt-10 text-center text-base text-maroon-900/80">Your calendar will appear as soon as your diary opens.</p>
                ) : (
                  <CalendarView
                    records={records}
                    rounds={rounds}
                    singleBlanks={singleBlanks}
                    onSingleBlanks={setSingleBlanks}
                    setGameBlanks={(game, blanks) => setPendingBlanks({ game, blanks })}
                    removeGame={askDelete}
                    removeRound={removeRound}
                    endRound={setPendingEndRound}
                    onAdd={(outcome, opts) => openEntry(outcome, opts)}
                    onRecap={setRecapDay}
                  />
                )}
              </div>

              <div hidden={view !== "hands"}>
                <div className="mt-2 grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                  <RoundBar
                    mode={mode}
                    onMode={setMode}
                    todayRound={todayRound}
                    currentRound={currentRound}
                    nextRoundNumber={nextRoundNumber}
                    onEndRound={setPendingEndRound}
                    singleBlanks={singleBlanks}
                    onSingleBlanks={setSingleBlanks}
                    todaySingles={todaySingles}
                    todayTournament={todayTournament}
                    today={todayTotals}
                    todayGames={todayGames}
                    onWin={() => openEntry("win")}
                    onLoss={() => openEntry("loss")}
                    onWall={() => openEntry("wall")}
                    onRemove={askDelete}
                    onRecap={() => setRecapDay(todayKey)}
                  />
                  {!noData && (
                    <CardChallenge
                      progress={progress}
                      totalWins={cardRecords.filter((r) => r.outcome === "win").length}
                      sections={sectionStatsList}
                    />
                  )}
                </div>

                {/* Find a hand: search, filters and section jump, right above the hands */}
                <section aria-labelledby="find-title" className="card mt-3 p-4 sm:p-5">
                  <h2 id="find-title" className="font-display text-xl font-bold text-maroon-800">
                    Find a hand
                  </h2>
                  <label className="mt-2 block text-sm font-semibold text-maroon-900/85" htmlFor="hand-search">
                    Search by tiles or section
                  </label>
                  <input
                    id="hand-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="For example 2468 or NEWS"
                    className="mt-1 min-h-12 w-full rounded-2xl border-2 border-maroon-900/20 bg-white px-4 text-base text-maroon-900 outline-none placeholder:text-maroon-900/50 focus:border-maroon-600 sm:max-w-md"
                  />
                  <p className="mt-3 text-sm font-semibold text-maroon-900/85">Show</p>
                  <div className="mt-1">
                    <FilterBar value={filter} onChange={setFilter} counts={filterCounts} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <p className="text-base text-maroon-900" role="status">
                      Showing <span className="font-semibold tabular-nums">{shownCount}</span> of {ALL_HANDS.length} hands
                      {filtered && (
                        <button onClick={resetFilters} className="ml-2 min-h-11 px-1 font-semibold text-maroon-700 underline underline-offset-2">
                          Reset
                        </button>
                      )}
                    </p>
                    {filter !== "recent" && sections.length > 1 && (
                      <label className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-maroon-900/85">
                        Jump to
                        <select
                          value=""
                          onChange={(e) => e.target.value && jumpTo(e.target.value)}
                          className="min-h-11 min-w-0 max-w-full rounded-xl border-2 border-maroon-900/20 bg-white px-2 text-base font-normal text-maroon-900 outline-none focus:border-maroon-600"
                        >
                          <option value="">Choose a section…</option>
                          {sections.map((s) => {
                            const p = sectionProgress.get(s.id);
                            return (
                              <option key={s.id} value={s.id}>
                                {s.name}
                                {p ? ` (${p.won} of ${p.total} won)` : ""}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    )}
                  </div>
                </section>

                <div className="mt-5 space-y-7">
                  {sections.map((section) => {
                    const p = sectionProgress.get(section.id);
                    return (
                      <section key={section.id} id={`sec-${section.id}`} className="scroll-mt-4" aria-label={section.name}>
                        <div className="mb-2.5 flex items-baseline gap-3">
                          <h2 className="font-display text-2xl font-bold text-maroon-700">{section.name}</h2>
                          {p && (
                            <span className="text-base text-maroon-900/80">
                              {p.won} of {p.total} won{p.won === p.total ? " ✓" : ""}
                            </span>
                          )}
                          <span className="h-px flex-1 self-center bg-maroon-900/15" />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {section.hands.map((hand) => (
                            <HandCard
                              key={hand.id}
                              hand={hand}
                              winCount={counts[hand.id] ?? 0}
                              lastWon={lastWonById.get(hand.id)}
                              note={notes[hand.id] ?? ""}
                              favorite={favorites.has(hand.id)}
                              celebrateKey={celebrate.handId === hand.id ? celebrate.key : 0}
                              onRequestWin={(h) => openEntry("win", modeOpts, h)}
                              onUndo={askDeleteLastWin}
                              onNoteChange={setNote}
                              onToggleFavorite={toggleFavorite}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}

                  {sections.length === 0 && (
                    <div className="card mx-auto max-w-md p-5 text-center">
                      {filter === "favorites" && !q ? (
                        <>
                          <p className="text-lg font-semibold text-maroon-900">No favorites yet</p>
                          <p className="mt-1 text-base text-maroon-900/85">Tap the ☆ star on any hand to keep it here.</p>
                          <button onClick={resetFilters} className="mt-3 min-h-12 rounded-full bg-maroon-700 px-5 text-base font-semibold text-cream-50 hover:bg-maroon-800">
                            Browse hands
                          </button>
                        </>
                      ) : filter === "recent" && !q ? (
                        <>
                          <p className="text-lg font-semibold text-maroon-900">No wins logged yet</p>
                          <p className="mt-1 text-base text-maroon-900/85">Hands you win will show up here, newest first.</p>
                          <button onClick={resetFilters} className="mt-3 min-h-12 rounded-full bg-maroon-700 px-5 text-base font-semibold text-cream-50 hover:bg-maroon-800">
                            Browse hands
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-semibold text-maroon-900">No hands match</p>
                          <p className="mt-1 text-base text-maroon-900/85">
                            {q ? `Nothing matches “${query.trim()}” with this filter.` : "No hands fit this filter right now."}
                          </p>
                          <div className="mt-3 flex flex-wrap justify-center gap-2">
                            {q && (
                              <button onClick={() => setQuery("")} className="min-h-12 rounded-full bg-maroon-700 px-5 text-base font-semibold text-cream-50 hover:bg-maroon-800">
                                Clear search
                              </button>
                            )}
                            <button onClick={resetFilters} className="min-h-12 rounded-full px-5 text-base font-semibold text-maroon-700 ring-1 ring-maroon-300 hover:bg-maroon-50">
                              Reset filters
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </main>

        <footer className="mt-14 text-center text-sm text-maroon-900/75">
          {email && onSignOut && (
            <p className="mb-3 text-base text-maroon-900/85">
              Signed in as <span className="font-semibold text-maroon-900">{email}</span>
              <button
                onClick={() => setConfirmSignOut(true)}
                className="ml-2 min-h-11 rounded-full px-3 font-semibold text-maroon-700 ring-1 ring-maroon-300 hover:bg-maroon-50"
              >
                Sign out
              </button>
            </p>
          )}
          My Mahj Diary · {CARD_YEAR} National Mah Jongg League card · {ALL_HANDS.length} hands 🀄
        </footer>

        {/* Toast: what was just logged, whether it's saved, and Undo */}
        <div
          className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 sm:bottom-5"
          aria-live="polite"
        >
          <AnimatePresence mode="wait">
            {toast && (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
                className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-maroon-800 py-2.5 pl-4 pr-2 text-cream-50 shadow-lg ${
                  toast.tone === "celebrate" ? "ring-2 ring-gold" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">
                    {toast.label} <span className="font-normal text-cream-100">· {toastSave}</span>
                  </p>
                  {toast.detail && <p className="text-sm text-cream-100">{toast.detail}</p>}
                </div>
                {toast.undo && (
                  <button
                    onClick={() => {
                      toast.undo?.();
                      setToast(null);
                    }}
                    className="min-h-11 shrink-0 rounded-full bg-cream-50/15 px-4 text-base font-semibold hover:bg-cream-50/25"
                  >
                    Undo
                  </button>
                )}
                <button
                  onClick={() => setToast(null)}
                  aria-label="Dismiss this message"
                  className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-cream-100 hover:bg-cream-50/15"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Phone: a persistent tab bar at the bottom, clear of the home indicator */}
        <nav
          aria-label="Main"
          hidden={typing}
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-maroon-900/15 bg-cream-50 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(52,8,17,0.08)] sm:hidden [&[hidden]]:hidden"
        >
          {VIEWS.map((v) => navButton(v, "bottom"))}
        </nav>
      </div>

      {/* Sheets and confirmations (each traps focus and makes the page behind it inert) */}
      <EntrySheet request={entry} recent={recentHands} favorites={favoriteHands} onSave={saveEntry} onClose={() => setEntry(null)} />
      <RecapSheet dayKey={recapDay} recap={recap} onClose={() => setRecapDay(null)} />
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this game?"
        body={
          <>
            <p className="font-semibold text-maroon-900">{pendingDelete ? describeGame(pendingDelete) : ""}</p>
            <p className="mt-1">
              It will be removed from your stats and calendar. Once deleted it can&apos;t be brought back, but you can log it
              again.
            </p>
          </>
        }
        confirmLabel="Delete game"
        onConfirm={() => {
          if (pendingDelete) removeGame(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={!!pendingEndRound}
        tone="plain"
        title="End this round early?"
        body={
          <p>
            The round stops at {endingCount} of {GAMES_PER_ROUND} games. Those games are kept, and the round stays marked
            &ldquo;ended early&rdquo; so it won&apos;t count as a completed round. Your next game starts a new round.
          </p>
        }
        cancelLabel="Keep playing it"
        confirmLabel="End round"
        onConfirm={() => {
          if (pendingEndRound) endRound(pendingEndRound);
          setPendingEndRound(null);
        }}
        onCancel={() => setPendingEndRound(null)}
      />
      <ConfirmDialog
        open={!!pendingBlanks}
        tone="plain"
        title={pendingBlanks?.blanks ? "Change this game to blanks?" : "Change this game to no blanks?"}
        body={
          <>
            <p className="font-semibold text-maroon-900">{pendingBlanks ? describeGame(pendingBlanks.game) : ""}</p>
            <p className="mt-1">This only changes whether the game was played with blanks. You can change it back the same way.</p>
          </>
        }
        cancelLabel="Leave it"
        confirmLabel={pendingBlanks?.blanks ? "Change to blanks" : "Change to no blanks"}
        onConfirm={() => {
          if (pendingBlanks) setGameBlanks(pendingBlanks.game, pendingBlanks.blanks);
          setPendingBlanks(null);
        }}
        onCancel={() => setPendingBlanks(null)}
      />
      <ConfirmDialog
        open={confirmSignOut}
        tone="plain"
        title="Sign out?"
        body={
          <p>
            Your games stay safe in your diary. You&apos;ll need a new code from your email to sign back in on this device.
          </p>
        }
        cancelLabel="Stay signed in"
        confirmLabel="Sign out"
        onConfirm={() => {
          setConfirmSignOut(false);
          void onSignOut?.();
        }}
        onCancel={() => setConfirmSignOut(false)}
      />
    </MotionConfig>
  );
}
