"use client";

import type { HandFilter } from "@/lib/types";

const OPTIONS: { key: HandFilter; label: string }[] = [
  { key: "all", label: "All hands" },
  { key: "won", label: "Won" },
  { key: "unwon", label: "Not yet won" },
  { key: "favorites", label: "★ Favorites" },
  { key: "recent", label: "Recently won" },
];

interface FilterBarProps {
  value: HandFilter;
  onChange: (next: HandFilter) => void;
  counts: Partial<Record<HandFilter, number>>;
}

// Every filter is visible at once (they wrap onto a second line on a phone
// rather than hiding off the side of the screen).
export function FilterBar({ value, onChange, counts }: FilterBarProps) {
  return (
    <div role="radiogroup" aria-label="Show which hands" className="flex flex-wrap gap-1.5">
      {OPTIONS.map((opt) => {
        const active = value === opt.key;
        const n = counts[opt.key];
        return (
          <button
            key={opt.key}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.key)}
            className={`min-h-11 whitespace-nowrap rounded-full px-3.5 text-base font-semibold ring-1 transition-colors ${
              active
                ? "bg-maroon-700 text-cream-50 ring-maroon-700"
                : "bg-cream-50 text-maroon-800 ring-maroon-900/20 hover:bg-cream-200"
            }`}
          >
            {active && <span aria-hidden>✓ </span>}
            {opt.label}
            {n !== undefined && (
              <span className={`ml-1.5 tabular-nums ${active ? "text-cream-100" : "text-maroon-900/70"}`}>{n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
