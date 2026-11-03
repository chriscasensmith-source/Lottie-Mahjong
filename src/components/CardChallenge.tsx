"use client";

import { motion } from "framer-motion";
import { CARD_YEAR } from "@/data/hands";
import type { CardProgress, SectionStat } from "@/lib/stats";

interface CardChallengeProps {
  progress: CardProgress;
  totalWins: number;
  sections: SectionStat[];
}

// Compact progress toward winning every hand on the card at least once.
export function CardChallenge({ progress, totalWins, sections }: CardChallengeProps) {
  // The unfinished sections with the fewest hands left: easy next targets.
  const closest = sections
    .filter((s) => s.wonHands < s.total)
    .sort((a, b) => a.total - a.wonHands - (b.total - b.wonHands) || b.wonHands - a.wonHands)
    .slice(0, 3);
  const { won, total, remaining, pct, nextMilestone, sectionsComplete } = progress;
  const toNext = nextMilestone ? nextMilestone - won : 0;
  return (
    <section
      aria-label={`The ${CARD_YEAR} card challenge`}
      className="card flex flex-col gap-3 p-4 sm:p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-maroon-800">The {CARD_YEAR} Card Challenge</h2>
        <span className="font-display text-2xl font-bold tabular-nums text-maroon-700">
          {Math.round(pct * 100)}%
        </span>
      </div>

      <div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-cream-200 ring-1 ring-inset ring-maroon-900/5"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={won}
          aria-label="Unique hands won"
        >
          <motion.div
            initial={false}
            animate={{ width: `${pct * 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
            className="h-full rounded-full bg-gradient-to-r from-maroon-600 to-maroon-700"
          />
        </div>
        <p className="mt-2 text-sm text-maroon-900">
          <span className="font-semibold tabular-nums">{won}</span> of {total} unique hands won
          <span className="text-maroon-900/70"> · {remaining} remaining</span>
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-cream-100 px-2 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-maroon-900/70">Total wins</dt>
          <dd className="font-display text-lg font-bold tabular-nums text-maroon-700">{totalWins}</dd>
        </div>
        <div className="rounded-xl bg-cream-100 px-2 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-maroon-900/70">Sections done</dt>
          <dd className="font-display text-lg font-bold tabular-nums text-maroon-700">{sectionsComplete.length}</dd>
        </div>
        <div className="rounded-xl bg-cream-100 px-2 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-maroon-900/70">Next goal</dt>
          <dd className="font-display text-lg font-bold tabular-nums text-maroon-700">
            {nextMilestone ?? "✓"}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-maroon-900/70">
        {nextMilestone
          ? `${toNext} more new hand${toNext === 1 ? "" : "s"} to reach ${nextMilestone === total ? "the whole card" : `${nextMilestone} unique hands`}.`
          : "Every hand on the card won. What a year!"}
        {sectionsComplete.length > 0 && ` Completed: ${sectionsComplete.join(", ")}.`}
      </p>

      {closest.length > 0 && (
        <div className="hidden border-t border-maroon-900/10 pt-3 lg:block">
          <p className="text-xs font-semibold text-maroon-900/80">Closest sections to finish</p>
          <ul className="mt-1.5 space-y-1">
            {closest.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm text-maroon-900">
                <span>{s.name}</span>
                <span className="tabular-nums text-maroon-900/75">
                  {s.wonHands}/{s.total} · {s.total - s.wonHands} to go
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
