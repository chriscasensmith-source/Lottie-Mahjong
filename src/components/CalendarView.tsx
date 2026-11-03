"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameRecord, Hand, Round } from "@/lib/types";
import {
  GAMES_PER_ROUND,
  dayKeyToDate,
  dayRecap,
  detailsRecorded,
  gamesByDay,
  localDayKey,
  outcomeTotals,
  roundsForDay,
  type RoundView,
} from "@/lib/stats";
import { SECTIONS, ALL_HANDS } from "@/data/hands";
import { OUTCOME_META } from "@/lib/outcomes";
import { RoundSlots } from "@/components/RoundBar";
import { GameRow } from "@/components/GameRow";
import { Segmented } from "@/components/WinSheet";
import { DaySummary } from "@/components/DaySummary";
import { HandPattern } from "@/components/HandCard";
import type { LogOptions } from "@/hooks/useWins";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// One maroon hue, deeper with more games. Steps follow her real play
// (most days have 5–12 games). The count is printed too, so color isn't the
// only signal.
const TIERS = [
  { min: 1, label: "1–4", cls: "bg-maroon-100 text-maroon-900" },
  { min: 5, label: "5–8", cls: "bg-maroon-200 text-maroon-900" },
  { min: 9, label: "9–12", cls: "bg-maroon-400 text-white" },
  { min: 13, label: "13+", cls: "bg-maroon-700 text-cream-50" },
];
function tierFor(count: number) {
  return [...TIERS].reverse().find((t) => count >= t.min)!;
}

const BLANKS_OPTIONS = [
  { value: false, label: "No blanks" },
  { value: true, label: "Blanks" },
];

const ROUND_STATUS: Record<RoundView["status"], string> = {
  complete: "Complete",
  open: "In progress",
  ended: "Ended early",
};

interface CalendarViewProps {
  records: GameRecord[];
  rounds: Round[];
  singleBlanks: boolean;
  onSingleBlanks: (b: boolean) => void;
  defaultBlanks: boolean;
  setGameBlanks: (record: GameRecord, blanks: boolean) => void;
  removeGame: (record: GameRecord) => void;
  removeRound: (roundId: string) => void;
  endRound: (roundId: string) => void;
  setRoundBlanks: (roundId: string, blanks: boolean) => void;
  onLog: (kind: "loss" | "wall", opts: LogOptions) => void;
  onRequestWin: (hand: Hand, opts: LogOptions, label: string) => void;
  onRecap: (dayKey: string) => void;
}

export function CalendarView({
  records,
  rounds,
  singleBlanks,
  onSingleBlanks,
  defaultBlanks,
  setGameBlanks,
  removeGame,
  removeRound,
  endRound,
  setRoundBlanks,
  onLog,
  onRequestWin,
  onRecap,
}: CalendarViewProps) {
  const today = new Date();
  const todayKey = localDayKey(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);
  const [openRound, setOpenRound] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Where a backdated game goes: a single game (default), an existing
  // round on that day, or a brand-new round. Never assigned silently.
  const [target, setTarget] = useState<string>("single");
  const [newRoundBlanks, setNewRoundBlanks] = useState(defaultBlanks);
  // After adding to a "New round", keep adding to that same round.
  const [followNew, setFollowNew] = useState(false);

  const byDay = useMemo(() => gamesByDay(records), [records]);
  const playedKeys = useMemo(() => [...byDay.keys()].sort(), [byDay]);
  const latestKey = playedKeys[playedKeys.length - 1] ?? null;

  const cells = useMemo(() => {
    const startDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (number | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    return out;
  }, [year, month]);

  function showMonthOf(key: string) {
    const d = dayKeyToDate(key);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }
  function select(key: string) {
    setSelectedKey(key);
    setOpenRound(null);
    setAdding(false);
    setTarget("single");
  }
  function moveMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  const monthName = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthGames = useMemo(
    () => records.filter((r) => localDayKey(new Date(r.won_at)).startsWith(monthPrefix)),
    [records, monthPrefix],
  );
  const monthTotals = outcomeTotals(monthGames);
  const monthDays = playedKeys.filter((k) => k.startsWith(monthPrefix)).length;

  const dayGames = byDay.get(selectedKey) ?? [];
  const day = useMemo(() => roundsForDay(selectedKey, rounds, records), [selectedKey, rounds, records]);
  const recap = useMemo(() => dayRecap(selectedKey, records, rounds), [selectedKey, records, rounds]);
  const selectedLabel = dayKeyToDate(selectedKey).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: selectedKey.slice(0, 4) === String(today.getFullYear()) ? undefined : "numeric",
  });
  const isFuture = selectedKey > todayKey;
  const hasActivity = dayGames.length > 0 || day.rounds.length > 0;

  // Older games (before rounds and details existed) vs single games logged since.
  const legacy = day.unassigned.filter((g) => !detailsRecorded(g));
  const singles = day.unassigned.filter((g) => detailsRecorded(g));
  const roomyRounds = day.rounds.filter((r) => r.games.length < GAMES_PER_ROUND);

  useEffect(() => {
    if (target !== "single" && target !== "new" && !roomyRounds.some((r) => r.round.id === target)) setTarget("single");
  }, [roomyRounds, target]);
  useEffect(() => setNewRoundBlanks(defaultBlanks), [defaultBlanks]);
  const newestRoundId = day.rounds[day.rounds.length - 1]?.round.id;
  useEffect(() => {
    if (!followNew || !newestRoundId) return;
    setTarget(newestRoundId);
    setFollowNew(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestRoundId]);

  // Timestamp on the selected day, using the current time-of-day (or the
  // end of the day for past dates, so the game sorts after earlier ones).
  function atDate(): Date {
    const [sy, sm, sd] = selectedKey.split("-").map(Number);
    if (selectedKey === todayKey) return new Date();
    const last = dayGames[dayGames.length - 1];
    const base = last ? new Date(last.won_at) : new Date(sy, sm - 1, sd, 12, 0, 0);
    const next = new Date(base.getTime() + 60_000);
    return localDayKey(next) === selectedKey ? next : new Date(sy, sm - 1, sd, 23, 59, 0);
  }

  function logOpts(): { opts: LogOptions; label: string } {
    const at = atDate();
    if (target === "single") {
      return { opts: { at, single: true, blanks: singleBlanks }, label: `Single game · ${singleBlanks ? "Blanks" : "No blanks"}` };
    }
    if (target === "new") {
      return { opts: { at, newRound: true, newRoundBlanks }, label: `Starts Round ${day.rounds.length + 1}` };
    }
    const rv = day.rounds.find((r) => r.round.id === target)!;
    return { opts: { at, roundId: target }, label: `Round ${rv.number} · Game ${rv.games.length + 1} of ${GAMES_PER_ROUND}` };
  }

  const targetOptions = [
    { value: "single", label: "Single game" },
    ...roomyRounds.map((r) => ({ value: r.round.id, label: `Round ${r.number} (${r.games.length}/${GAMES_PER_ROUND})` })),
    { value: "new", label: "New round" },
  ];

  return (
    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Month grid */}
      <section aria-label="Month" className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => moveMonth(-1)}
            aria-label="Previous month"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-200 text-lg text-maroon-800 hover:bg-cream-300"
          >
            ‹
          </button>
          <div className="text-center">
            <h2 className="font-display text-lg font-bold text-maroon-800">{monthName}</h2>
            <p className="text-xs text-maroon-900/75">
              {monthDays
                ? `${monthDays} playing day${monthDays === 1 ? "" : "s"} · ${monthTotals.total} games · ${monthTotals.win} wins`
                : "No games this month"}
            </p>
          </div>
          <button
            onClick={() => moveMonth(1)}
            aria-label="Next month"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-200 text-lg text-maroon-800 hover:bg-cream-300"
          >
            ›
          </button>
        </div>

        <div className="mt-3 flex justify-center gap-2">
          <button
            onClick={() => {
              showMonthOf(todayKey);
              select(todayKey);
            }}
            className="min-h-9 rounded-full px-3 text-xs font-semibold text-maroon-700 ring-1 ring-maroon-300 hover:bg-maroon-50"
          >
            Today
          </button>
          {latestKey && (
            <button
              onClick={() => {
                showMonthOf(latestKey);
                select(latestKey);
              }}
              className="min-h-9 rounded-full px-3 text-xs font-semibold text-maroon-700 ring-1 ring-maroon-300 hover:bg-maroon-50"
            >
              Last game day ·{" "}
              {dayKeyToDate(latestKey).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label={monthName}>
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="pb-1 text-center text-[11px] font-semibold uppercase text-maroon-900/70" aria-hidden>
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} />;
            const key = localDayKey(new Date(year, month, d));
            const games = byDay.get(key) ?? [];
            const n = games.length;
            const o = n ? outcomeTotals(games) : null;
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            const label = new Date(year, month, d).toLocaleDateString(undefined, { month: "long", day: "numeric" });
            return (
              <button
                key={key}
                onClick={() => select(key)}
                aria-pressed={isSelected}
                aria-label={
                  o
                    ? `${label}: ${n} games, ${o.win} wins, ${o.loss} losses, ${o.wall} wall games${isToday ? ", today" : ""}`
                    : `${label}: no games${isToday ? ", today" : ""}`
                }
                title={o ? `${n} games · ${o.win}W ${o.loss}L ${o.wall} wall` : undefined}
                className={`relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                  n > 0 ? tierFor(n).cls : "bg-cream-200/60 text-maroon-900/75 hover:bg-cream-300"
                } ${isSelected ? "ring-[3px] ring-gold-dark ring-offset-2 ring-offset-cream-50" : ""}`}
              >
                <span className={`leading-none ${isToday ? "font-extrabold underline decoration-2 underline-offset-2" : "font-semibold"}`}>
                  {d}
                </span>
                {n > 0 && <span className="mt-0.5 text-[10px] font-bold leading-none tabular-nums">{n}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-maroon-900/75">
          <span>Games per day:</span>
          {TIERS.map((t) => (
            <span key={t.label} className="flex items-center gap-1">
              <span className={`h-3 w-3 rounded ${t.cls.split(" ")[0]}`} />
              {t.label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded ring-2 ring-gold-dark" /> selected
          </span>
          <span className="font-extrabold underline">Today</span>
        </div>
      </section>

      {/* Day detail */}
      <section aria-label="Selected day" className="card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-maroon-800">{selectedLabel}</h2>
          {hasActivity && dayGames.length > 0 && (
            <button
              onClick={() => onRecap(selectedKey)}
              className="min-h-9 shrink-0 rounded-full bg-cream-200 px-3 text-xs font-semibold text-maroon-800 hover:bg-cream-300"
            >
              Recap
            </button>
          )}
        </div>

        {hasActivity && dayGames.length > 0 && (
          <div className="mt-3 space-y-2">
            <DaySummary recap={recap} />
            {recap.firstTimeHands.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gold-light/50 px-3 py-2 ring-1 ring-gold/50">
                <span className="text-xs font-bold text-gold-dark">✨ First win:</span>
                {recap.firstTimeHands.map((h) => (
                  <HandPattern key={h.id} hand={h} className="text-xs font-extrabold" />
                ))}
              </div>
            )}
          </div>
        )}

        {!hasActivity && (
          <div className="mt-4 rounded-2xl bg-cream-100 px-4 py-5 text-center">
            <p className="text-sm text-maroon-900/80">No games logged for this date.</p>
            {!isFuture && !adding && (
              <button
                onClick={() => setAdding(true)}
                className="mt-3 min-h-10 rounded-full bg-maroon-700 px-4 text-sm font-semibold text-cream-50 hover:bg-maroon-800"
              >
                + Add a game to this day
              </button>
            )}
          </div>
        )}

        {/* Rounds */}
        {day.rounds.length > 0 && (
          <ul className="mt-4 space-y-2">
            {day.rounds.map((rv) => {
              const open = openRound === rv.round.id || day.rounds.length === 1;
              const w = rv.games.filter((g) => g.outcome === "win").length;
              return (
                <li key={rv.round.id} className="rounded-2xl bg-white ring-1 ring-maroon-900/10">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                    <button
                      onClick={() => setOpenRound(open && day.rounds.length > 1 ? null : rv.round.id)}
                      aria-expanded={open}
                      className="flex min-h-10 flex-1 items-center gap-3 text-left"
                    >
                      <span className="flex flex-col">
                        <span className="whitespace-nowrap font-display text-base font-bold text-maroon-800">
                          Round {rv.number}
                        </span>
                        <span className="whitespace-nowrap text-[11px] text-maroon-900/75">
                          {ROUND_STATUS[rv.status]} · {rv.games.length}/{GAMES_PER_ROUND} · {w} won
                        </span>
                      </span>
                      <RoundSlots games={rv.games} size="sm" />
                      {day.rounds.length > 1 && <span className="ml-auto text-maroon-900/60">{open ? "▴" : "▾"}</span>}
                    </button>
                    <Segmented
                      size="sm"
                      label={`Round ${rv.number} blanks`}
                      value={rv.round.blanks}
                      onChange={(b) => setRoundBlanks(rv.round.id, b)}
                      options={BLANKS_OPTIONS}
                    />
                  </div>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        {rv.games.length === 0 ? (
                          <div className="flex items-center justify-between px-3 pb-3 text-sm text-maroon-900/75">
                            No games in this round yet.
                            <button onClick={() => removeRound(rv.round.id)} className="text-xs font-semibold text-maroon-700 underline">
                              Remove empty round
                            </button>
                          </div>
                        ) : (
                          <ul className="space-y-1.5 px-3 pb-3">
                            {rv.games.map((g, i) => (
                              <GameRow key={g.id ?? g.won_at} game={g} index={i + 1} onRemove={removeGame} />
                            ))}
                            {rv.status === "open" && rv.games.length > 0 && selectedKey !== todayKey && (
                              <li className="pt-1 text-right">
                                <button onClick={() => endRound(rv.round.id)} className="text-xs font-semibold text-maroon-700 underline">
                                  End this round at {rv.games.length} of {GAMES_PER_ROUND}
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}

        {singles.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 card-title">Single games · {singles.length}</p>
            <ul className="space-y-1.5">
              {singles.map((g) => (
                <GameRow key={g.id ?? g.won_at} game={g} onRemove={removeGame} onToggleBlanks={setGameBlanks} />
              ))}
            </ul>
          </div>
        )}

        {legacy.length > 0 && (
          <div className="mt-4">
            <p className="card-title">Games · {legacy.length}</p>
            <p className="mb-2 mt-0.5 text-[11px] text-maroon-900/70">
              Logged before rounds and game details were tracked, so they&apos;re listed by time.
            </p>
            <ul className="space-y-1.5">
              {legacy.map((g) => (
                <GameRow key={g.id ?? g.won_at} game={g} onRemove={removeGame} />
              ))}
            </ul>
          </div>
        )}

        {hasActivity && (
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-[11px] text-maroon-900/75">
            {(["win", "loss", "wall"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span className={`h-2.5 w-2.5 rounded-sm ${OUTCOME_META[k].dot}`} />
                {OUTCOME_META[k].emoji} {OUTCOME_META[k].label}
              </span>
            ))}
          </div>
        )}

        {/* Add a game to this day (backdating for missed entries) */}
        {isFuture ? (
          <p className="mt-4 text-sm text-maroon-900/75">You can&apos;t add games to a future date.</p>
        ) : !adding ? (
          hasActivity && (
            <button
              onClick={() => setAdding(true)}
              className="mt-4 min-h-10 w-full rounded-2xl border-2 border-dashed border-maroon-900/20 text-sm font-semibold text-maroon-700 hover:bg-cream-100"
            >
              + Add a game to this day
            </button>
          )
        ) : (
          <div className="mt-4 rounded-2xl bg-cream-100 p-3 ring-1 ring-maroon-900/10">
            <div className="mb-2 flex items-center justify-between">
              <p className="card-title">Add a game to this day</p>
              <button onClick={() => setAdding(false)} className="text-xs font-semibold text-maroon-700 underline">
                Done
              </button>
            </div>

            <label className="text-xs font-semibold text-maroon-900/80" htmlFor="add-target">
              Add it as
            </label>
            <select
              id="add-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-lg border border-maroon-900/20 bg-white px-2 text-sm text-maroon-900 outline-none focus:border-maroon-500"
            >
              {targetOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {(target === "single" || target === "new") && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-maroon-900/80">
                  {target === "single" ? "This game" : "The new round"}
                </span>
                <Segmented
                  size="sm"
                  label="Blanks"
                  value={target === "single" ? singleBlanks : newRoundBlanks}
                  onChange={target === "single" ? onSingleBlanks : setNewRoundBlanks}
                  options={BLANKS_OPTIONS}
                />
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
              <select
                value=""
                onChange={(e) => {
                  const hand = ALL_HANDS.find((h) => h.id === e.target.value);
                  if (!hand) return;
                  const { opts, label } = logOpts();
                  onRequestWin(hand, opts, label);
                  if (target === "new") setFollowNew(true);
                }}
                aria-label="Add a winning hand to this day"
                className="col-span-2 min-h-10 w-full min-w-0 rounded-lg border border-maroon-900/20 bg-white px-2 text-sm text-maroon-900 outline-none focus:border-maroon-500 sm:col-span-1"
              >
                <option value="">🏆 Add a win…</option>
                {SECTIONS.map((s) => (
                  <optgroup key={s.id} label={s.name}>
                    {s.hands.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.pattern.map((p) => p.text).join(" ")} · {h.points} pts {h.concealed ? "Concealed" : "Exposed"}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {(["loss", "wall"] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => {
                    onLog(kind, logOpts().opts);
                    if (target === "new") setFollowNew(true);
                  }}
                  className={`min-h-10 rounded-lg px-3 text-sm font-semibold ring-1 ${OUTCOME_META[kind].soft} ${OUTCOME_META[kind].ink} ${OUTCOME_META[kind].ring}`}
                >
                  + {kind === "loss" ? "Loss" : "Wall"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-maroon-900/70">
              Games added here only join a round if you pick one above.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
