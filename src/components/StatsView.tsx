"use client";

import { motion } from "framer-motion";
import type { GameOutcome, GameRecord, TileColor } from "@/lib/types";
import { ALL_HANDS } from "@/data/hands";
import {
  winsBySection,
  topHands,
  winsByDay,
  recentActivity,
  outcomeTotals,
  totalPoints,
  relativeTime,
} from "@/lib/stats";

const COLOR_CLASS: Record<TileColor, string> = {
  green: "text-tile-green",
  red: "text-tile-red",
  blue: "text-tile-blue",
  neutral: "text-tile-neutral",
};

const OUTCOME_META: Record<
  GameOutcome,
  { label: string; emoji: string; bar: string; text: string }
> = {
  win: { label: "Win", emoji: "🏆", bar: "bg-emerald-400", text: "text-emerald-300" },
  loss: { label: "Loss", emoji: "❌", bar: "bg-rose-400", text: "text-rose-300" },
  wall: { label: "Wall", emoji: "🧱", bar: "bg-amber-400", text: "text-amber-300" },
};

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur"
    >
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-100/70">
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

interface StatsViewProps {
  records: GameRecord[];
  removeGame: (record: GameRecord) => void;
}

export function StatsView({ records, removeGame }: StatsViewProps) {
  const o = outcomeTotals(records);
  const sections = winsBySection(records);
  const top = topHands(records, 6);
  const days = winsByDay(records, 14);
  const activity = recentActivity(records, 10);
  const points = totalPoints(records);
  const playedHands = new Set(
    records.filter((r) => r.outcome === "win" && r.hand_id).map((r) => r.hand_id),
  ).size;
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  if (o.total === 0) {
    return (
      <div className="mt-16 text-center text-emerald-100/60">
        <p className="text-5xl">📊</p>
        <p className="mt-3 text-lg font-medium text-emerald-100/80">
          No games logged yet
        </p>
        <p className="mt-1 text-sm">
          Log a win on a hand, or record a loss / wall game — your stats will
          appear here.
        </p>
      </div>
    );
  }

  const summary = [
    { label: "Games", value: o.total, accent: "text-white" },
    { label: "Wins", value: o.win, accent: "text-emerald-300" },
    { label: "Win rate", value: `${Math.round(o.winRate)}%`, accent: "text-tile-blue" },
    { label: "Points", value: points, accent: "text-amber-300" },
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
            className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur"
          >
            <div className={`text-2xl font-bold ${s.accent}`}>{s.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-emerald-100/60">
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Outcome breakdown */}
      <Card title="Game outcomes">
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/10">
          {(["win", "loss", "wall"] as GameOutcome[]).map((k) => {
            const count = o[k];
            const pct = o.total ? (count / o.total) * 100 : 0;
            if (!pct) return null;
            return (
              <motion.div
                key={k}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                className={OUTCOME_META[k].bar}
                title={`${OUTCOME_META[k].label}: ${count}`}
              />
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {(["win", "loss", "wall"] as GameOutcome[]).map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-sm ${OUTCOME_META[k].bar}`}
              />
              <span className="text-emerald-50">{OUTCOME_META[k].label}</span>
              <span className="font-semibold tabular-nums text-emerald-100/70">
                {o[k]}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Section completion: distinct hands won vs total in the section */}
        <Card title="Section progress">
          <div className="space-y-2.5">
            {sections.map((s) => {
              const pct = s.total ? (s.playedHands / s.total) * 100 : 0;
              const done = s.total > 0 && s.playedHands >= s.total;
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 truncate text-sm text-emerald-50">
                    {s.name}
                  </div>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      className={`h-full rounded-full bg-gradient-to-r ${
                        done
                          ? "from-amber-400 to-amber-300"
                          : "from-emerald-500 to-emerald-300"
                      }`}
                    />
                  </div>
                  <div className="w-12 text-right text-sm font-semibold tabular-nums text-emerald-100">
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
                    className={`w-full rounded-t-md ${
                      d.count ? "bg-emerald-400" : "bg-white/10"
                    }`}
                    style={{ minHeight: d.count ? 6 : 2 }}
                  />
                </div>
                <span className="text-[9px] text-emerald-100/50">
                  {d.weekday[0]}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Most-won hands */}
        <Card title="Most-won hands">
          {top.length === 0 ? (
            <p className="text-sm text-emerald-100/50">No wins yet.</p>
          ) : (
            <ol className="space-y-2">
              {top.map((t, i) => (
                <li
                  key={t.hand.id}
                  className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2"
                >
                  <span className="w-5 text-center text-sm font-bold text-emerald-300/80">
                    {i + 1}
                  </span>
                  <div className="flex flex-1 flex-wrap items-center gap-x-1.5 overflow-hidden">
                    {t.hand.pattern.map((g, gi) => (
                      <span
                        key={gi}
                        className={`text-sm font-bold ${COLOR_CLASS[g.color]} brightness-150`}
                      >
                        {g.text}
                      </span>
                    ))}
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                    {t.wins}×
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Recent activity */}
        <Card title="Recent activity">
          <ul className="space-y-2">
            {activity.map((a) => (
              <li
                key={a.record.id ?? a.record.won_at}
                className="group flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-base">{OUTCOME_META[a.outcome].emoji}</span>
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={`text-sm font-medium ${OUTCOME_META[a.outcome].text}`}
                    >
                      {a.hand ? a.sectionName : OUTCOME_META[a.outcome].label}
                    </span>
                    {a.hand && (
                      <span className="truncate text-xs text-emerald-100/50">
                        {a.hand.pattern.map((g) => g.text).join(" ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-emerald-100/50">
                    {relativeTime(a.record.won_at)}
                  </span>
                  <button
                    onClick={() => removeGame(a.record)}
                    title="Remove this game"
                    className="rounded-full px-1.5 py-0.5 text-xs text-emerald-100/40 transition-colors hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
