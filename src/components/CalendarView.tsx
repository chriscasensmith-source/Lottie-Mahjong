"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameRecord, Hand, PlayMode, Round } from "@/lib/types";
import {
  GAMES_PER_ROUND,
  gamePoints,
  gamesByDay,
  localDayKey,
  roundsForDay,
} from "@/lib/stats";
import { SECTIONS, ALL_HANDS } from "@/data/hands";
import { OUTCOME_META } from "@/lib/outcomes";
import { RoundSlots } from "@/components/RoundBar";
import { GameRow } from "@/components/GameRow";
import { Segmented } from "@/components/WinSheet";
import type { LogOptions } from "@/hooks/useWins";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// Sequential fill (one hue, maroon) by games played that day; the count is
// also printed in the cell so meaning never rides on color alone.
function cellTier(count: number): string {
  if (count >= 4) return "bg-maroon-700 text-cream-50";
  if (count >= 2) return "bg-maroon-300 text-white";
  return "bg-maroon-100 text-maroon-800";
}

interface CalendarViewProps {
  records: GameRecord[];
  rounds: Round[];
  mode: PlayMode;
  onMode: (m: PlayMode) => void;
  singleBlanks: boolean;
  onSingleBlanks: (b: boolean) => void;
  setGameBlanks: (record: GameRecord, blanks: boolean) => void;
  defaultBlanks: boolean;
  removeGame: (record: GameRecord) => void;
  removeRound: (roundId: string) => void;
  setRoundBlanks: (roundId: string, blanks: boolean) => void;
  startRound: (opts?: { at?: Date; blanks?: boolean }) => void;
  logLoss: (opts?: LogOptions) => void;
  logWall: (opts?: LogOptions) => void;
  onRequestWin: (hand: Hand, at: Date) => void;
}

export function CalendarView({
  records,
  rounds,
  mode,
  onMode,
  singleBlanks,
  onSingleBlanks,
  setGameBlanks,
  defaultBlanks,
  removeGame,
  removeRound,
  setRoundBlanks,
  startRound,
  logLoss,
  logWall,
  onRequestWin,
}: CalendarViewProps) {
  const today = new Date();
  const todayKey = localDayKey(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);
  const [openRound, setOpenRound] = useState<string | null>(null);

  const byDay = useMemo(() => gamesByDay(records), [records]);

  const cells = useMemo(() => {
    const startDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (number | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    return out;
  }, [year, month]);

  function moveMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  const monthName = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const playedThisMonth = cells.filter(
    (d) => d && (byDay.get(localDayKey(new Date(year, month, d)))?.length ?? 0) > 0,
  ).length;

  const dayGames = byDay.get(selectedKey) ?? [];
  const day = useMemo(
    () => roundsForDay(selectedKey, rounds, records),
    [selectedKey, rounds, records],
  );
  const selectedLabel = new Date(`${selectedKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const isFuture = selectedKey > todayKey;

  // Timestamp on the selected day, using the current time-of-day.
  function atDate(): Date {
    const [sy, sm, sd] = selectedKey.split("-").map(Number);
    const now = new Date();
    return new Date(sy, sm - 1, sd, now.getHours(), now.getMinutes(), now.getSeconds());
  }

  // Options for a loss/wall added to this day, following the current mode.
  function addOpts(): LogOptions {
    return mode === "single"
      ? { at: atDate(), single: true, blanks: singleBlanks }
      : { at: atDate(), newRoundBlanks: defaultBlanks };
  }

  const count = (o: GameRecord["outcome"]) => dayGames.filter((g) => g.outcome === o).length;
  const dayTiles = [
    { label: "Games", value: dayGames.length },
    { label: "Wins", value: count("win") },
    { label: "Losses", value: count("loss") },
    { label: "Walls", value: count("wall") },
    { label: "Points", value: dayGames.reduce((s, g) => s + gamePoints(g), 0) },
  ];

  return (
    <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Month grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-cream-50 p-5 shadow-sm ring-1 ring-maroon-900/10"
      >
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => moveMonth(-1)}
            aria-label="Previous month"
            className="rounded-full bg-cream-200 px-3 py-1.5 text-sm text-maroon-800 hover:bg-cream-300"
          >
            ‹
          </button>
          <div className="text-center">
            <h3 className="font-display text-lg font-bold text-maroon-800">{monthName}</h3>
            <p className="text-xs text-maroon-900/50">
              {playedThisMonth
                ? `Played on ${playedThisMonth} day${playedThisMonth === 1 ? "" : "s"}`
                : "No games this month"}
            </p>
          </div>
          <button
            onClick={() => moveMonth(1)}
            aria-label="Next month"
            className="rounded-full bg-cream-200 px-3 py-1.5 text-sm text-maroon-800 hover:bg-cream-300"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="pb-1 text-center text-[11px] font-semibold uppercase text-maroon-900/40">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} />;
            const key = localDayKey(new Date(year, month, d));
            const n = byDay.get(key)?.length ?? 0;
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedKey(key);
                  setOpenRound(null);
                }}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-all ${
                  n > 0 ? cellTier(n) : "bg-cream-200/70 text-maroon-900/50 hover:bg-cream-300"
                } ${isSelected ? "ring-2 ring-maroon-500 ring-offset-2 ring-offset-cream-50" : isToday ? "ring-1 ring-maroon-900/40" : ""}`}
              >
                <span className="font-semibold leading-none">{d}</span>
                {n > 0 && (
                  <span className="mt-0.5 text-[10px] font-bold leading-none opacity-80">{n} 🀄</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-maroon-900/50">
          <span>Fewer</span>
          <span className="h-3 w-3 rounded bg-maroon-100" />
          <span className="h-3 w-3 rounded bg-maroon-300" />
          <span className="h-3 w-3 rounded bg-maroon-700" />
          <span>more games</span>
        </div>
      </motion.div>

      {/* Day detail */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-3xl bg-cream-50 p-5 shadow-sm ring-1 ring-maroon-900/10"
      >
        <h3 className="font-display text-lg font-bold text-maroon-800">{selectedLabel}</h3>

        {/* Add a game to this day (backdating for missed entries) */}
        {isFuture ? (
          <p className="mt-3 text-sm text-maroon-900/45">Can&apos;t add games to a future day.</p>
        ) : (
          <div className="mt-3 rounded-2xl bg-cream-100 p-3 ring-1 ring-maroon-900/10">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-maroon-900/55">
                Add a game to this day
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="sm"
                  label="Add as"
                  value={mode}
                  onChange={onMode}
                  options={[
                    { value: "rounds" as PlayMode, label: "Rounds" },
                    { value: "single" as PlayMode, label: "Single game" },
                  ]}
                />
                {mode === "single" && (
                  <Segmented
                    size="sm"
                    label="Blanks for this game"
                    value={singleBlanks}
                    onChange={onSingleBlanks}
                    options={[
                      { value: false, label: "No blanks" },
                      { value: true, label: "Blanks" },
                    ]}
                  />
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value=""
                onChange={(e) => {
                  const hand = ALL_HANDS.find((h) => h.id === e.target.value);
                  if (hand) onRequestWin(hand, atDate());
                }}
                aria-label="Add a winning hand to this day"
                className="w-full min-w-0 rounded-lg border border-maroon-900/15 bg-white px-2 py-2 text-sm text-maroon-900 outline-none focus:border-maroon-500 sm:w-auto sm:flex-1"
              >
                <option value="">🏆 Add a win…</option>
                {SECTIONS.map((s) => (
                  <optgroup key={s.id} label={s.name}>
                    {s.hands.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.pattern.map((p) => p.text).join(" ")} · {h.points}
                        {h.concealed ? "C" : "X"}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                onClick={() => logLoss(addOpts())}
                className="rounded-lg bg-outcome-loss-soft px-3 py-2 text-sm font-semibold text-outcome-loss-ink ring-1 ring-outcome-loss/30 hover:bg-outcome-loss/20"
              >
                + Loss
              </button>
              <button
                onClick={() => logWall(addOpts())}
                className="rounded-lg bg-outcome-wall-soft px-3 py-2 text-sm font-semibold text-outcome-wall-ink ring-1 ring-outcome-wall/30 hover:bg-outcome-wall/20"
              >
                + Wall
              </button>
              {mode === "rounds" && (
                <button
                  onClick={() => startRound({ at: atDate(), blanks: defaultBlanks })}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-maroon-700 ring-1 ring-maroon-300 hover:bg-maroon-50"
                >
                  + New round
                </button>
              )}
            </div>
          </div>
        )}

        {dayGames.length === 0 && day.rounds.length === 0 ? (
          <div className="mt-8 text-center text-maroon-900/45">
            <p className="text-4xl">🀫</p>
            <p className="mt-2 text-sm">No games logged this day.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {dayTiles.map((t) => (
                <div key={t.label} className="rounded-xl bg-cream-100 px-2 py-2.5 text-center ring-1 ring-maroon-900/5">
                  <div className="font-display text-lg font-bold tabular-nums text-maroon-700">{t.value}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-maroon-900/50">{t.label}</div>
                </div>
              ))}
            </div>

            {/* Rounds */}
            <ul className="mt-4 space-y-2.5">
              {day.rounds.map((rv) => {
                const open = openRound === rv.round.id || day.rounds.length === 1;
                const wins = rv.games.filter((g) => g.outcome === "win").length;
                return (
                  <li key={rv.round.id} className="rounded-2xl bg-white ring-1 ring-maroon-900/10">
                    <div className="flex flex-wrap items-center gap-3 p-3">
                      <button
                        onClick={() => setOpenRound(open && day.rounds.length > 1 ? null : rv.round.id)}
                        aria-expanded={open}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <span className="whitespace-nowrap font-display text-base font-bold text-maroon-800">
                          Round {rv.number}
                        </span>
                        <RoundSlots games={rv.games} size="sm" />
                        <span className="whitespace-nowrap text-xs text-maroon-900/50">
                          {rv.games.length}/{GAMES_PER_ROUND} · {wins} won
                        </span>
                        {day.rounds.length > 1 && (
                          <span className="ml-auto text-maroon-900/40">{open ? "▴" : "▾"}</span>
                        )}
                      </button>
                      <Segmented
                        size="sm"
                        label={`Round ${rv.number} blanks`}
                        value={rv.round.blanks}
                        onChange={(b) => setRoundBlanks(rv.round.id, b)}
                        options={[
                          { value: false, label: "No blanks" },
                          { value: true, label: "Blanks" },
                        ]}
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
                            <div className="flex items-center justify-between px-3 pb-3 text-sm text-maroon-900/50">
                              No games in this round yet.
                              <button
                                onClick={() => removeRound(rv.round.id)}
                                className="text-xs text-maroon-700 underline-offset-2 hover:underline"
                              >
                                Remove empty round
                              </button>
                            </div>
                          ) : (
                            <ul className="space-y-1.5 px-3 pb-3">
                              <AnimatePresence initial={false}>
                                {rv.games.map((g, i) => (
                                  <GameRow key={g.id ?? g.won_at} game={g} index={i + 1} onRemove={removeGame} />
                                ))}
                              </AnimatePresence>
                            </ul>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>

            {/* Single games (played outside a round) */}
            {day.unassigned.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-maroon-900/50">
                  Single games · {day.unassigned.length}
                </p>
                <ul className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {day.unassigned.map((g) => (
                      <GameRow
                        key={g.id ?? g.won_at}
                        game={g}
                        onRemove={removeGame}
                        onToggleBlanks={setGameBlanks}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-[11px] text-maroon-900/55">
              {(["win", "loss", "wall"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`h-2.5 w-2.5 rounded-sm ${OUTCOME_META[k].dot}`} />
                  {OUTCOME_META[k].label}
                </span>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
