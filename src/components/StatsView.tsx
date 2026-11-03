"use client";

import { motion } from "framer-motion";
import type { GameOutcome, GameRecord, Round } from "@/lib/types";
import { ALL_HANDS } from "@/data/hands";
import {
  winsBySection,
  topHands,
  winsByDay,
  recentActivity,
  outcomeTotals,
  totalPoints,
  isAlwaysJokerless,
} from "@/lib/stats";
import { OUTCOME_META } from "@/lib/outcomes";
import { COLOR_CLASS } from "@/components/HandCard";
import { GameRow } from "@/components/GameRow";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-cream-50 p-5 shadow-sm ring-1 ring-maroon-900/10"
    >
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-maroon-900/55">
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

interface StatsViewProps {
  records: GameRecord[];
  rounds: Round[];
  removeGame: (record: GameRecord) => void;
}

export function StatsView({ records, rounds, removeGame }: StatsViewProps) {
  const o = outcomeTotals(records);
  const sections = winsBySection(records);
  const top = topHands(records, 6);
  const days = winsByDay(records, 14);
  const activity = recentActivity(records, 10);
  const points = totalPoints(records);
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const wins = records.filter((r) => r.outcome === "win" && r.hand_id);
  const selfDrawn = wins.filter((r) => r.self_drawn).length;
  const jokerless = wins.filter((r) => r.jokerless && !isAlwaysJokerless(r.hand_id!)).length;
  const blanksRounds = rounds.filter((r) => r.blanks).length;

  if (o.total === 0) {
    return (
      <div className="mt-16 text-center text-maroon-900/55">
        <p className="text-5xl">📊</p>
        <p className="mt-3 font-display text-lg font-semibold text-maroon-800">No games logged yet</p>
        <p className="mt-1 text-sm">
          Log a win on a hand, or record a loss / wall game — your stats will appear here.
        </p>
      </div>
    );
  }

  const summary = [
    { label: "Games", value: o.total },
    { label: "Wins", value: o.win },
    { label: "Win rate", value: `${Math.round(o.winRate)}%` },
    { label: "Points", value: points },
  ];
  const details = [
    { label: "Rounds played", value: rounds.length },
    { label: "Self-drawn wins", value: `${selfDrawn}/${o.win}` },
    { label: "No-joker wins", value: `${jokerless}/${o.win}` },
    { label: "Rounds w/ blanks", value: `${blanksRounds}/${rounds.length}` },
  ];

  return (
    <div className="mt-8 space-y-5">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl bg-cream-50 p-4 shadow-sm ring-1 ring-maroon-900/10"
          >
            <div className="font-display text-3xl font-bold tabular-nums text-maroon-700">{s.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-maroon-900/55">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Outcome breakdown */}
        <Card title="Game outcomes">
          <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-cream-200">
            {(["win", "loss", "wall"] as GameOutcome[]).map((k) => {
              const pct = o.total ? (o[k] / o.total) * 100 : 0;
              if (!pct) return null;
              return (
                <motion.div
                  key={k}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  className={OUTCOME_META[k].dot}
                  title={`${OUTCOME_META[k].label}: ${o[k]}`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {(["win", "loss", "wall"] as GameOutcome[]).map((k) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${OUTCOME_META[k].dot}`} />
                <span className="text-maroon-900/80">{OUTCOME_META[k].label}</span>
                <span className="font-semibold tabular-nums text-maroon-900">{o[k]}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Round & win details */}
        <Card title="Rounds & wins">
          <div className="grid grid-cols-2 gap-2">
            {details.map((d) => (
              <div key={d.label} className="rounded-xl bg-cream-100 px-3 py-2.5 ring-1 ring-maroon-900/5">
                <div className="font-display text-xl font-bold tabular-nums text-maroon-700">{d.value}</div>
                <div className="text-[11px] uppercase tracking-wide text-maroon-900/55">{d.label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Section completion */}
        <Card title="Section progress">
          <div className="space-y-2.5">
            {sections.map((s) => {
              const pct = s.total ? (s.playedHands / s.total) * 100 : 0;
              const done = s.total > 0 && s.playedHands >= s.total;
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 truncate text-sm text-maroon-900/80">{s.name}</div>
                  <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-cream-200">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      className={`h-full rounded-full ${done ? "bg-cream-500" : "bg-maroon-600"}`}
                    />
                  </div>
                  <div className="w-12 text-right text-sm font-semibold tabular-nums text-maroon-900">
                    {s.playedHands}/{s.total}
                    {done && " ✓"}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Wins over time */}
        <Card title="Wins · last 14 days">
          <div className="flex h-40 items-end gap-1.5">
            {days.map((d) => (
              <div
                key={d.key}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${d.label}: ${d.count} win${d.count === 1 ? "" : "s"}`}
              >
                <div className="flex h-32 w-full items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.count / maxDay) * 100}%` }}
                    transition={{ type: "spring", stiffness: 140, damping: 18 }}
                    className={`w-full rounded-t ${d.count ? "bg-maroon-600" : "bg-cream-300"}`}
                    style={{ minHeight: d.count ? 6 : 2 }}
                  />
                </div>
                <span className="text-[9px] text-maroon-900/50">{d.weekday[0]}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Most-won hands */}
        <Card title="Most-won hands">
          {top.length === 0 ? (
            <p className="text-sm text-maroon-900/50">No wins yet.</p>
          ) : (
            <ol className="space-y-2">
              {top.map((t, i) => (
                <li key={t.hand.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-maroon-900/5">
                  <span className="w-5 text-center font-display text-sm font-bold text-maroon-600">{i + 1}</span>
                  <div className="flex flex-1 flex-wrap items-center gap-x-1.5 overflow-hidden">
                    {t.hand.pattern.map((g, gi) => (
                      <span key={gi} className={`text-sm font-bold ${COLOR_CLASS[g.color]}`}>
                        {g.text}
                      </span>
                    ))}
                  </div>
                  <span className="shrink-0 rounded-full bg-maroon-100 px-2 py-0.5 text-xs font-semibold text-maroon-700">
                    {t.wins}×
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Recent activity */}
        <Card title="Recent activity">
          <ul className="space-y-1.5">
            {activity.map((a) => (
              <GameRow
                key={a.record.id ?? a.record.won_at}
                game={a.record}
                meta={a.sectionName || undefined}
                showDate
                onRemove={removeGame}
              />
            ))}
          </ul>
        </Card>
      </div>

      <p className="text-center text-xs text-maroon-900/45">
        Points use NMJL doubling: no jokers ×2 (except Singles &amp; Pairs), self-drawn ×2.
        {" "}
        {ALL_HANDS.length} hands on the card.
      </p>
    </div>
  );
}
