"use client";

import { motion } from "framer-motion";

interface StatItem {
  label: string;
  value: string | number;
}

function Stat({ label, value }: StatItem) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-w-[5.25rem] flex-col items-center rounded-2xl bg-cream-50 px-4 py-3 shadow-sm ring-1 ring-maroon-900/10"
    >
      <motion.span
        key={String(value)}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        className="font-display text-2xl font-bold tabular-nums text-maroon-700"
      >
        {value}
      </motion.span>
      <span className="mt-0.5 text-[11px] uppercase tracking-wide text-maroon-900/55">
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
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      <Stat label="Hands" value={totalHands} />
      <Stat label="Played" value={playedCount} />
      <Stat label="To go" value={totalHands - playedCount} />
      <Stat label="Wins" value={totalWins} />
      <Stat label="Complete" value={`${pct}%`} />
    </div>
  );
}
