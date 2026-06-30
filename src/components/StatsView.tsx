"use client";

import { motion } from "framer-motion";
import type { TileColor, WinRecord } from "@/lib/types";
import { ALL_HANDS } from "@/data/hands";
import {
  winsBySection,
  topHands,
  winsByDay,
  recentWins,
  totalPoints,
  relativeTime,
} from "@/lib/stats";

const COLOR_CLASS: Record<TileColor, string> = {
  green: "text-tile-green",
  red: "text-tile-red",
  blue: "text-tile-blue",
  neutral: "text-tile-neutral",
};

function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur ${className}`}
    >
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-100/70">
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

export function StatsView({ records }: { records: WinRecord[] }) {
  const sections = winsBySection(records);
  const top = topHands(records, 6);
  const days = winsByDay(records, 14);
  const recent = recentWins(records, 8);
  const points = totalPoints(records);

  const totalWins = records.length;
  const playedHands = new Set(records.map((r) => r.hand_id)).size;
  const maxSectionWins = Math.max(1, ...sections.map((s) => s.wins));
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const best = [...sections].sort((a, b) => b.wins - a.wins)[0];

  if (totalWins === 0) {
    return (
      <div className="mt-16 text-center text-emerald-100/60">
        <p className="text-5xl">📊</p>
        <p className="mt-3 text-lg font-medium text-emerald-100/80">
          No wins logged yet
        </p>
        <p className="mt-1 text-sm">
          Tap <span className="font-semibold">+ Log win</span> on a hand and your
          stats will appear here.
        </p>
      </div>
    );
  }

  const summary = [
    { label: "Total wins", value: totalWins, accent: "text-emerald-300" },
    {
      label: "Hands played",
      value: `${playedHands}/${ALL_HANDS.length}`,
      accent: "text-white",
    },
    { label: "Points scored", value: points, accent: "text-amber-300" },
    { label: "Top section", value: best?.wins ? best.name : "—", accent: "text-tile-blue" },
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Wins by section */}
        <Card title="Wins by section">
          <div className="space-y-2.5">
            {sections.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className="w-28 shrink-0 truncate text-sm text-emerald-50">
                  {s.name}
                </div>
                <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.wins / maxSectionWins) * 100}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                  />
                </div>
                <div className="w-6 text-right text-sm font-semibold tabular-nums text-emerald-100">
                  {s.wins}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Wins over time */}
        <Card title="Last 14 days">
          <div className="flex h-40 items-end gap-1.5">
            {days.map((d) => (
              <div
                key={d.key}
                className="group flex flex-1 flex-col items-center gap-1"
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

        {/* Recent wins */}
        <Card title="Recent wins">
          <ul className="space-y-2">
            {recent.map((r) => (
              <li
                key={r.record.id ?? r.record.won_at}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-emerald-50">
                    {r.sectionName}
                  </span>
                  <span className="truncate text-xs text-emerald-100/50">
                    {r.hand.pattern.map((g) => g.text).join(" ")}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-emerald-100/50">
                  {relativeTime(r.record.won_at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
