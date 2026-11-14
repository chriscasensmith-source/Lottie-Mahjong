"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CARD_YEAR } from "@/data/hands";
import type { CardProgress, SectionStat } from "@/lib/stats";

interface CardChallengeProps {
  progress: CardProgress;
  totalWins: number;
  sections: SectionStat[];
}

// Progress toward winning every hand on the card at least once. Compact by
// default; "Show details" opens everything else (nothing was removed).
export function CardChallenge({ progress, totalWins, sections }: CardChallengeProps) {
  const [open, setOpen] = useState(false);
  // The unfinished sections with the fewest hands left: easy next targets.
  const closest = sections
    .filter((s) => s.wonHands < s.total)
    .sort((a, b) => a.total - a.wonHands - (b.total - b.wonHands) || b.wonHands - a.wonHands)
    .slice(0, 3);
  const { won, total, remaining, pct, nextMilestone, sectionsComplete } = progress;
  const toNext = nextMilestone ? nextMilestone - won : 0;

  return (
    <section aria-labelledby="challenge-title" className="card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="challenge-title" className="font-display text-lg font-bold text-maroon-800">
          The {CARD_YEAR} Card Challenge
        </h2>
        <span className="font-display text-xl font-bold tabular-nums text-maroon-700">{Math.round(pct * 100)}%</span>
      </div>

      <div
        className="mt-2 h-3 w-full overflow-hidden rounded-full bg-cream-200 ring-1 ring-inset ring-maroon-900/10"
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
          className="h-full rounded-full bg-maroon-700"
        />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3">
        <p className="text-base text-maroon-900">
          <span className="font-semibold tabular-nums">{won}</span> of {total} unique hands won
          <span className="text-maroon-900/75"> · {remaining} to go</span>
        </p>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="challenge-details"
          className="min-h-11 px-1 text-sm font-semibold text-maroon-700 underline underline-offset-2"
        >
          {open ? "Hide details" : "Show details"}
        </button>
      </div>

      <div id="challenge-details" hidden={!open} className="mt-2 space-y-3 border-t border-maroon-900/10 pt-3">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Total wins", value: totalWins },
            { label: "Sections done", value: sectionsComplete.length },
            { label: "Next goal", value: nextMilestone ?? "✓" },
          ].map((t) => (
            <div key={t.label} className="flex flex-col-reverse rounded-xl bg-cream-100 px-2 py-2">
              <dt className="text-sm text-maroon-900/80">{t.label}</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-maroon-700">{t.value}</dd>
            </div>
          ))}
        </dl>

        <p className="text-base text-maroon-900/85">
          {nextMilestone
            ? `${toNext} more new hand${toNext === 1 ? "" : "s"} to reach ${nextMilestone === total ? "the whole card" : `${nextMilestone} unique hands`}.`
            : "Every hand on the card won. What a year!"}
          {sectionsComplete.length > 0 && ` Completed: ${sectionsComplete.join(", ")}.`}
        </p>

        {closest.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-maroon-900/85">Closest sections to finish</h3>
            <ul className="mt-1 space-y-1">
              {closest.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-base text-maroon-900">
                  <span>{s.name}</span>
                  <span className="tabular-nums text-maroon-900/80">
                    {s.wonHands} of {s.total} · {s.total - s.wonHands} to go
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
