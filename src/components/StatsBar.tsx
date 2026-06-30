"use client";

import { motion } from "framer-motion";

interface StatItem {
  label: string;
  value: string | number;
  accent?: string;
}

function Stat({ label, value, accent }: StatItem) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-w-[5.5rem] flex-col items-center rounded-2xl bg-white/10 px-4 py-3 backdrop-blur"
    >
      <motion.span
        key={String(value)}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        className={`text-2xl font-bold tabular-nums ${accent ?? "text-white"}`}
      >
        {value}
      </motion.span>
      <span className="mt-0.5 text-[11px] uppercase tracking-wide text-emerald-100/70">
        {label}
      </span>
    </motion.div>
  );
}

interface StatsBarProps {
  totalHands: number;
  playedCount: number;
  totalWins: number;
}

export function StatsBar({ totalHands, playedCount, totalWins }: StatsBarProps) {
  const pct = totalHands ? Math.round((playedCount / totalHands) * 100) : 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Stat label="Hands" value={totalHands} />
      <Stat label="Played" value={playedCount} accent="text-emerald-300" />
      <Stat label="To Go" value={totalHands - playedCount} accent="text-amber-300" />
      <Stat label="Total Wins" value={totalWins} accent="text-tile-blue" />
      <Stat label="Complete" value={`${pct}%`} accent="text-emerald-300" />
    </div>
  );
}
