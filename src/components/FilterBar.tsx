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

// Scrolls sideways on narrow phones instead of wrapping into a tall block.
export function FilterBar({ value, onChange, counts }: FilterBarProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Show hands"
      className="no-scrollbar -mx-4 flex max-w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:flex-wrap sm:justify-center sm:px-0"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.key;
        const n = counts[opt.key];
        return (
          <button
            key={opt.key}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.key)}
            className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold ring-1 transition-colors ${
              active
                ? "bg-maroon-700 text-cream-50 ring-maroon-700"
                : "bg-cream-50 text-maroon-800 ring-maroon-900/15 hover:bg-cream-200"
            }`}
          >
            {opt.label}
            {n !== undefined && (
              <span className={`ml-1.5 tabular-nums ${active ? "text-cream-100/85" : "text-maroon-900/60"}`}>
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
