import type { DayRecap } from "@/lib/stats";
import { fmtNum } from "@/lib/stats";

// The at-a-glance numbers for one day. Rounds only appear once tracked.
export function DaySummary({ recap }: { recap: DayRecap }) {
  const t = recap.totals;
  const tiles = [
    { label: "Games", value: t.total },
    { label: "Wins", value: t.win, cls: "text-outcome-win-ink" },
    { label: "Losses", value: t.loss, cls: "text-outcome-loss-ink" },
    { label: "Walls", value: t.wall, cls: "text-outcome-wall-ink" },
    { label: "Points", value: fmtNum(recap.points) },
    ...(recap.completedRounds > 0 ? [{ label: "Rounds", value: recap.completedRounds }] : []),
  ];
  return (
    <dl className={`grid gap-1.5 ${tiles.length > 5 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-5"}`}>
      {tiles.map((x) => (
        <div key={x.label} className="flex flex-col-reverse rounded-xl bg-cream-100 px-1 py-2 text-center ring-1 ring-maroon-900/5">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-maroon-900/70">{x.label}</dt>
          <dd className={`font-display text-lg font-bold tabular-nums ${x.cls ?? "text-maroon-700"}`}>{x.value}</dd>
        </div>
      ))}
    </dl>
  );
}
