"use client";

import { Sheet, SheetHeader } from "@/components/Sheet";
import type { DayRecap } from "@/lib/stats";
import { dayKeyToDate, fmtNum, fmtPct } from "@/lib/stats";
import { HandPattern } from "@/components/HandCard";
import { DaySummary } from "@/components/DaySummary";

interface RecapSheetProps {
  dayKey: string | null; // null = closed
  recap: DayRecap | null;
  onClose: () => void;
}

// A short, optional recap of one playing day. Never blocks logging.
export function RecapSheet({ dayKey, recap, onClose }: RecapSheetProps) {
  const label = dayKey
    ? dayKeyToDate(dayKey).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <Sheet open={!!dayKey && !!recap} onClose={onClose} labelledBy="recap-title">
      <SheetHeader id="recap-title" title={label} sub="Day recap" onClose={onClose} />
      {recap && (
        <>
      <div className="mt-4">
        <DaySummary recap={recap} />
      </div>

      <p className="mt-3 text-sm text-maroon-900/80">
        Decisive-game win rate:{" "}
        <span className="font-semibold text-maroon-900">{fmtPct(recap.totals.decisiveRate)}</span>
        {recap.totals.decided > 0 && (
          <span className="text-maroon-900/70">
            {" "}
            ({recap.totals.win} of {recap.totals.decided} decided games)
          </span>
        )}
        {recap.uniqueHands > 0 && (
          <>
            <br />
            {recap.uniqueHands} different hand{recap.uniqueHands === 1 ? "" : "s"} won ·{" "}
            {fmtNum(recap.points)} hand points
          </>
        )}
      </p>

      {recap.firstTimeHands.length > 0 && (
        <div className="mt-4 rounded-2xl bg-gold-light/50 p-3 ring-1 ring-gold/50">
          <p className="text-xs font-bold text-gold-dark">
            ✨ First-time win{recap.firstTimeHands.length === 1 ? "" : "s"}
          </p>
          <ul className="mt-1.5 space-y-1">
            {recap.firstTimeHands.map((h) => (
              <li key={h.id}>
                <HandPattern hand={h} className="text-sm font-extrabold" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onClose}
        className="mt-5 min-h-11 w-full rounded-full bg-maroon-700 text-sm font-semibold text-cream-50 hover:bg-maroon-800"
      >
        Done
      </button>
        </>
      )}
    </Sheet>
  );
}
