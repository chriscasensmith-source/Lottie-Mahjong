"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameOutcome, GameRecord, TileColor } from "@/lib/types";
import { gamesByDay, localDayKey, handById, relativeTime } from "@/lib/stats";
import { SECTIONS } from "@/data/hands";

const COLOR_CLASS: Record<TileColor, string> = {
  green: "text-tile-green",
  red: "text-tile-red",
  blue: "text-tile-blue",
  neutral: "text-tile-neutral",
};

const OUTCOME_META: Record<
  GameOutcome,
  { label: string; emoji: string; text: string }
> = {
  win: { label: "Win", emoji: "🏆", text: "text-emerald-300" },
  loss: { label: "Loss", emoji: "❌", text: "text-rose-300" },
  wall: { label: "Wall", emoji: "🧱", text: "text-amber-300" },
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// Sequential fill: one hue (emerald), light -> dark by games played that day.
// The count is also printed in the cell, so meaning never rides on color alone.
function cellTier(count: number): string {
  if (count >= 3) return "bg-emerald-300 text-emerald-950";
  if (count === 2) return "bg-emerald-500/60 text-white";
  return "bg-emerald-500/30 text-emerald-50";
}

interface CalendarViewProps {
  records: GameRecord[];
  removeGame: (record: GameRecord) => void;
  logWin: (handId: string, at?: Date) => void;
  logLoss: (at?: Date) => void;
  logWall: (at?: Date) => void;
}

export function CalendarView({
  records,
  removeGame,
  logWin,
  logLoss,
  logWall,
}: CalendarViewProps) {
  const today = new Date();
  const todayKey = localDayKey(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);

  const byDay = useMemo(() => gamesByDay(records), [records]);

  // Leading blanks + the month's days.
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
  const dayWins = dayGames.filter((g) => g.outcome === "win");
  const dayPoints = dayWins.reduce(
    (sum, g) => sum + (g.hand_id ? (handById(g.hand_id)?.points ?? 0) : 0),
    0,
  );
  const selectedDate = new Date(`${selectedKey}T12:00:00`);
  const selectedLabel = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const isFuture = selectedKey > todayKey;

  // Timestamp on the selected day, using the current time-of-day so a
  // backdated entry gets a sensible time and stable ordering.
  function atDate(): Date {
    const [sy, sm, sd] = selectedKey.split("-").map(Number);
    const now = new Date();
    return new Date(sy, sm - 1, sd, now.getHours(), now.getMinutes(), now.getSeconds());
  }

  const dayTiles = [
    { label: "Games", value: dayGames.length, accent: "text-white" },
    { label: "Wins", value: dayWins.length, accent: "text-emerald-300" },
    {
      label: "Losses",
      value: dayGames.filter((g) => g.outcome === "loss").length,
      accent: "text-rose-300",
    },
    {
      label: "Walls",
      value: dayGames.filter((g) => g.outcome === "wall").length,
      accent: "text-amber-300",
    },
    { label: "Points", value: dayPoints, accent: "text-amber-300" },
  ];

  return (
    <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Month grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
      >
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => moveMonth(-1)}
            aria-label="Previous month"
            className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-emerald-50 transition-colors hover:bg-white/20"
          >
            ‹
          </button>
          <div className="text-center">
            <h3 className="text-lg font-bold text-emerald-50">{monthName}</h3>
            <p className="text-xs text-emerald-100/50">
              {playedThisMonth
                ? `Played on ${playedThisMonth} day${playedThisMonth === 1 ? "" : "s"}`
                : "No games this month"}
            </p>
          </div>
          <button
            onClick={() => moveMonth(1)}
            aria-label="Next month"
            className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-emerald-50 transition-colors hover:bg-white/20"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w, i) => (
            <div
              key={i}
              className="pb-1 text-center text-[11px] font-semibold uppercase text-emerald-100/40"
            >
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} />;
            const key = localDayKey(new Date(year, month, d));
            const count = byDay.get(key)?.length ?? 0;
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-all ${
                  count > 0
                    ? cellTier(count)
                    : "bg-white/5 text-emerald-100/50 hover:bg-white/10"
                } ${isSelected ? "ring-2 ring-emerald-300" : isToday ? "ring-1 ring-white/40" : ""}`}
              >
                <span className="font-semibold leading-none">{d}</span>
                {count > 0 && (
                  <span className="mt-0.5 text-[10px] font-bold leading-none opacity-80">
                    {count} 🀄
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend: sequential intensity + count printed in-cell */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-emerald-100/50">
          <span>Fewer</span>
          <span className="h-3 w-3 rounded bg-emerald-500/30" />
          <span className="h-3 w-3 rounded bg-emerald-500/60" />
          <span className="h-3 w-3 rounded bg-emerald-300" />
          <span>more games</span>
        </div>
      </motion.div>

      {/* Day detail */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
      >
        <h3 className="text-lg font-bold text-emerald-50">{selectedLabel}</h3>

        {/* Add a game to this day (backdating for missed entries) */}
        {isFuture ? (
          <p className="mt-3 text-sm text-emerald-100/40">
            Can&apos;t add games to a future day.
          </p>
        ) : (
          <div className="mt-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-100/60">
              Add a game to this day
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) logWin(e.target.value, atDate());
                }}
                aria-label="Add a winning hand to this day"
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-stone-900/50 px-2 py-2 text-sm text-emerald-50 outline-none focus:border-emerald-400"
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
                onClick={() => logLoss(atDate())}
                className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 ring-1 ring-rose-400/30 transition-colors hover:bg-rose-500/25"
              >
                + Loss
              </button>
              <button
                onClick={() => logWall(atDate())}
                className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-200 ring-1 ring-amber-400/30 transition-colors hover:bg-amber-500/25"
              >
                + Wall
              </button>
            </div>
          </div>
        )}

        {dayGames.length === 0 ? (
          <div className="mt-10 text-center text-emerald-100/50">
            <p className="text-4xl">🀫</p>
            <p className="mt-2 text-sm">No games logged this day.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {dayTiles.map((t) => (
                <div
                  key={t.label}
                  className="rounded-xl bg-white/5 px-2 py-2.5 text-center"
                >
                  <div className={`text-lg font-bold tabular-nums ${t.accent}`}>
                    {t.value}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-emerald-100/50">
                    {t.label}
                  </div>
                </div>
              ))}
            </div>

            <ul className="mt-4 space-y-2">
              <AnimatePresence initial={false}>
                {[...dayGames].reverse().map((g) => {
                  const hand = g.hand_id ? handById(g.hand_id) : null;
                  const time = new Date(g.won_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  return (
                    <motion.li
                      key={g.id ?? g.won_at}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-base">
                          {OUTCOME_META[g.outcome].emoji}
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span
                            className={`text-sm font-medium ${OUTCOME_META[g.outcome].text}`}
                          >
                            {hand
                              ? `${OUTCOME_META[g.outcome].label} · ${hand.points} pts`
                              : OUTCOME_META[g.outcome].label}
                          </span>
                          {hand && (
                            <span className="flex flex-wrap gap-x-1 truncate text-xs font-semibold">
                              {hand.pattern.map((p, pi) => (
                                <span
                                  key={pi}
                                  className={`${COLOR_CLASS[p.color]} brightness-150`}
                                >
                                  {p.text}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className="text-xs text-emerald-100/50"
                          title={relativeTime(g.won_at)}
                        >
                          {time}
                        </span>
                        <button
                          onClick={() => removeGame(g)}
                          title="Remove this game"
                          className="rounded-full px-1.5 py-0.5 text-xs text-emerald-100/40 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          ✕
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </>
        )}
      </motion.div>
    </div>
  );
}
