"use client";

import { motion } from "framer-motion";
import type { HandFilter } from "@/lib/types";

const OPTIONS: { key: HandFilter; label: string }[] = [
  { key: "all", label: "All hands" },
  { key: "played", label: "Played" },
  { key: "unplayed", label: "Not played" },
];

interface FilterBarProps {
  value: HandFilter;
  onChange: (next: HandFilter) => void;
}

export function FilterBar({ value, onChange }: FilterBarProps) {
  return (
    <div className="inline-flex rounded-full bg-black/25 p-1 backdrop-blur">
      {OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className="relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
          >
            {active && (
              <motion.span
                layoutId="filter-pill"
                className="absolute inset-0 rounded-full bg-emerald-400"
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              />
            )}
            <span
              className={`relative z-10 ${
                active ? "text-emerald-950" : "text-emerald-100/80"
              }`}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
