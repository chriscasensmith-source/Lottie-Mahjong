"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { GameOutcome, GameRecord, Round } from "@/lib/types";
import { CARD_YEAR } from "@/data/hands";
import {
  cardProgress,
  cardYearRecords,
  detailStats,
  fmtNum,
  fmtPct,
  outcomeTotals,
  outcomesByMonth,
  outcomesByPlayingDate,
  recentActivity,
  recentDecisiveRate,
  roundStats,
  sectionStats,
  topHands,
  totalPoints,
  pointsBreakdown,
  tournamentStats,
  JOKERLESS_BONUS,
  SELF_DRAWN_BONUS,
  DISCARD_PENALTY,
  ratio,
  MILESTONES,
  type OutcomeBucket,
} from "@/lib/stats";
import { OUTCOME_META } from "@/lib/outcomes";
import { HandPattern } from "@/components/HandCard";
import { GameRow } from "@/components/GameRow";
import { Segmented } from "@/components/Segmented";
import { downloadCsv, gamesToCsv } from "@/lib/export";

const OUTCOMES: GameOutcome[] = ["win", "loss", "wall"];

// A panel. With `collapsible`, the title is a button that opens the detail,
// so the page reads as an overview first and the depth is one tap away.
function Card({
  title,
  subtitle,
  children,
  className = "",
  collapsible = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
}) {
  const heading = (
    <div className="min-w-0">
      <h3 className="font-display text-lg font-bold text-maroon-800">{title}</h3>
      {subtitle && <p className="text-sm text-maroon-900/80">{subtitle}</p>}
    </div>
  );
  if (!collapsible) {
    return (
      <section className={`card p-4 sm:p-5 ${className}`} aria-label={title}>
        <div className="mb-3">{heading}</div>
        {children}
      </section>
    );
  }
  return (
    <details className={`card group ${className}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-3xl p-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        {heading}
        <span className="shrink-0 text-sm font-semibold text-maroon-700 underline underline-offset-2">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </details>
  );
}

// A metric with a one-line explanation of exactly what it measures.
function Metric({
  label,
  value,
  detail,
  explain,
}: {
  label: string;
  value: string;
  detail?: string;
  explain: string;
}) {
  const empty = value === "—";
  return (
    <div className="rounded-2xl bg-cream-100 p-3 ring-1 ring-maroon-900/5">
      <div className="text-sm font-semibold text-maroon-900/85">{label}</div>
      {empty ? (
        <div className="py-1 text-base font-semibold text-maroon-900/80">Not enough recorded games yet</div>
      ) : (
        <div className="font-display text-2xl font-bold tabular-nums text-maroon-700">{value}</div>
      )}
      {detail && <div className="text-sm tabular-nums text-maroon-900/85">{detail}</div>}
      <p className="mt-1 text-sm leading-snug text-maroon-900/75">{explain}</p>
    </div>
  );
}

// The same numbers as the chart, as a table (for screen readers, or anyone who prefers it).
function BucketTable({ buckets, rate }: { buckets: OutcomeBucket[]; rate: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-base">
        <caption className="sr-only">{rate ? "Decisive win rate by month" : "Games by date"}</caption>
        <thead>
          <tr className="border-b border-maroon-900/15 text-sm text-maroon-900/80">
            <th scope="col" className="py-1.5 pr-2 font-semibold">{rate ? "Month" : "When"}</th>
            <th scope="col" className="py-1.5 pr-2 text-right font-semibold">Wins</th>
            <th scope="col" className="py-1.5 pr-2 text-right font-semibold">Losses</th>
            <th scope="col" className="py-1.5 pr-2 text-right font-semibold">Walls</th>
            <th scope="col" className="py-1.5 text-right font-semibold">{rate ? "Win rate" : "Games"}</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key} className="border-b border-maroon-900/5 last:border-0">
              <th scope="row" className="py-1.5 pr-2 font-normal">{b.label}</th>
              <td className="py-1.5 pr-2 text-right tabular-nums">{b.win}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{b.loss}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{b.wall}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{rate ? fmtPct(b.decisiveRate) : b.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend({ counts }: { counts?: Record<GameOutcome, number> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {OUTCOMES.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm ${OUTCOME_META[k].dot}`} aria-hidden />
          <span className="text-maroon-900/85">
            <span aria-hidden>{OUTCOME_META[k].emoji} </span>
            {k === "win" ? "Wins" : k === "loss" ? "Losses" : "Wall games"}
          </span>
          {counts && <span className="font-semibold tabular-nums text-maroon-900">{fmtNum(counts[k])}</span>}
        </span>
      ))}
    </div>
  );
}

// Stacked outcome columns: every game is counted, walls included.
function StackedBars({ buckets }: { buckets: OutcomeBucket[] }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const sel = buckets.find((b) => b.key === active) ?? buckets[buckets.length - 1];
  return (
    <div>
      <div className="relative flex h-40 items-end gap-1 border-b border-maroon-900/15 sm:gap-1.5">
        {buckets.map((b) => (
          <button
            key={b.key}
            onClick={() => setActive(b.key)}
            onMouseEnter={() => setActive(b.key)}
            aria-label={`${b.label}: ${b.total} games, ${b.win} wins, ${b.loss} losses, ${b.wall} wall games`}
            className={`group flex h-full flex-1 flex-col justify-end rounded-t ${sel?.key === b.key ? "bg-maroon-900/5" : ""}`}
          >
            <div
              className="flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px]"
              style={{ height: `${(b.total / max) * 100}%` }}
            >
              {OUTCOMES.map((k) =>
                b[k] ? (
                  <div key={k} className={`${OUTCOME_META[k].dot} w-full shrink-0`} style={{ flexGrow: b[k], flexBasis: 0 }} />
                ) : null,
              )}
            </div>
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-1 sm:gap-1.5">
        {buckets.map((b, i) => (
          <span key={b.key} className="flex-1 text-center text-xs tabular-nums text-maroon-900/70">
            {buckets.length > 8 && i % 2 === 1 && i !== buckets.length - 1 ? "" : b.label}
          </span>
        ))}
      </div>
      {sel && (
        <p className="mt-2 text-sm text-maroon-900/85" aria-live="polite">
          <span className="font-semibold text-maroon-900">{sel.label}</span> · {sel.total} games · {sel.win} wins ·{" "}
          {sel.loss} losses · {sel.wall} wall{sel.wall === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

// Decisive win rate per month, with the sample under each bar. Months with
// very few decided games are shown lighter so they don't over-read.
function RateBars({ buckets }: { buckets: OutcomeBucket[] }) {
  const [active, setActive] = useState<string | null>(null);
  const rates = buckets.map((b) => b.decisiveRate ?? 0);
  const max = Math.max(0.5, ...rates);
  const sel = buckets.find((b) => b.key === active) ?? buckets[buckets.length - 1];
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5 border-b border-maroon-900/15">
        {buckets.map((b) => {
          const decided = b.win + b.loss;
          const small = decided < 10;
          return (
            <button
              key={b.key}
              onClick={() => setActive(b.key)}
              onMouseEnter={() => setActive(b.key)}
              aria-label={`${b.label}: ${fmtPct(b.decisiveRate)} decisive win rate, ${b.win} of ${decided} decided games`}
              className={`relative flex h-full flex-1 flex-col items-center justify-end rounded-t ${sel?.key === b.key ? "bg-maroon-900/5" : ""}`}
            >
              {b.decisiveRate !== null && (
                <span className="mb-0.5 text-xs font-semibold tabular-nums text-maroon-900/85">
                  {Math.round(b.decisiveRate * 100)}%
                </span>
              )}
              <div
                className={`w-full rounded-t-[4px] ${small ? "bg-maroon-300" : "bg-maroon-600"}`}
                style={{ height: `${((b.decisiveRate ?? 0) / max) * 80}%`, minHeight: b.decisiveRate ? 2 : 0 }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {buckets.map((b) => (
          <span key={b.key} className="flex-1 text-center text-xs leading-tight text-maroon-900/70">
            {b.label}
            <br />
            <span className="tabular-nums">n={b.win + b.loss}</span>
          </span>
        ))}
      </div>
      {sel && (
        <p className="mt-2 text-sm text-maroon-900/85" aria-live="polite">
          <span className="font-semibold text-maroon-900">{sel.label}</span> · {fmtPct(sel.decisiveRate)} ·{" "}
          {sel.win} wins of {sel.win + sel.loss} decided games
          {sel.wall ? ` (${sel.wall} walls not counted)` : ""}
        </p>
      )}
      <p className="mt-1 text-xs text-maroon-900/70">
        n = decided games that month. Lighter bars have fewer than 10, so treat them as rough.
      </p>
    </div>
  );
}

interface StatsViewProps {
  records: GameRecord[];
  rounds: Round[];
  removeGame: (record: GameRecord) => void;
  onStartTournament: () => void;
  onGoToHands: () => void;
}

type Chart = "dates" | "months" | "rate";

export function StatsView({ records, rounds, removeGame, onStartTournament, onGoToHands }: StatsViewProps) {
  const [chart, setChart] = useState<Chart>("dates");
  const [asTable, setAsTable] = useState(false);

  const s = useMemo(() => {
    const card = cardYearRecords(records);
    return {
      o: outcomeTotals(records),
      recent: recentDecisiveRate(records, 50),
      points: totalPoints(records),
      pts: pointsBreakdown(records),
      tour: tournamentStats(records),
      sections: sectionStats(card),
      top: topHands(card, 6),
      activity: recentActivity(records, 10),
      details: detailStats(records, rounds),
      rounds: roundStats(records, rounds),
      byDate: outcomesByPlayingDate(records, 12),
      byMonth: outcomesByMonth(records),
      card,
      cardO: outcomeTotals(card),
      progress: cardProgress(card),
      cardPoints: totalPoints(card),
      cardTop: topHands(card, 1)[0],
    };
  }, [records, rounds]);
  const { o, recent, details: d, rounds: r } = s;

  if (o.total === 0) {
    return (
      <div className="mt-16 text-center text-maroon-900/75">
        <p className="text-5xl" aria-hidden>
          📊
        </p>
        <p className="mt-3 font-display text-xl font-semibold text-maroon-800">No games logged yet</p>
        <p className="mt-1 text-base">Your stats appear here after your first game.</p>
        <button onClick={onGoToHands} className="mt-4 min-h-12 rounded-full bg-maroon-700 px-5 text-base font-semibold text-cream-50 hover:bg-maroon-800">
          Log your first game
        </button>
      </div>
    );
  }

  const singleGames = records.filter((g) => !g.round_id).length;

  function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`my-mahj-diary-games-${stamp}.csv`, gamesToCsv(records, rounds));
  }

  return (
    <div className="mt-3 space-y-4">
      {/* Lifetime totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Games", value: o.total },
          { label: "Wins", value: o.win },
          { label: "Losses", value: o.loss },
          { label: "Wall games", value: o.wall },
          { label: "Points", value: s.points, wide: true },
        ].map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`card p-4 ${t.wide ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <div className="font-display text-3xl font-bold tabular-nums text-maroon-700">{fmtNum(t.value)}</div>
            <div className="mt-0.5 text-xs font-semibold text-maroon-900/75">{t.label}</div>
          </motion.div>
        ))}
      </div>
      <p className="-mt-1 px-1 text-xs text-maroon-900/70">
        All time. Games = wins + losses + wall games. Points = winning hands
        {s.pts.penalties > 0
          ? ` (${fmtNum(s.pts.handPoints)}) minus ${s.pts.penalties} tournament discard${s.pts.penalties === 1 ? "" : "s"} (−${fmtNum(s.pts.penaltyPoints)}).`
          : "."}
      </p>

      <div className="card flex flex-col items-start gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-maroon-800">Export games</h3>
          <p className="text-sm text-maroon-900/80">
            Downloads a spreadsheet (CSV) of every game: date, outcome, mode, hand, points and round. Details that were never
            recorded say &ldquo;not recorded.&rdquo; Hand notes and favorites are not included.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="min-h-12 shrink-0 rounded-full bg-maroon-700 px-5 text-base font-semibold text-cream-50 hover:bg-maroon-800"
        >
          Export games
        </button>
      </div>

      {/* Win rates */}
      <Card title="Win rates" subtitle="Two honest ways to count. They answer different questions.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Overall win rate"
            value={fmtPct(o.winRate)}
            detail={`${fmtNum(o.win)} of ${fmtNum(o.total)} games`}
            explain="Wins out of every game played, wall games included."
          />
          <Metric
            label="Decisive-game win rate"
            value={fmtPct(o.decisiveRate)}
            detail={`${fmtNum(o.win)} of ${fmtNum(o.decided)} decided games`}
            explain="Wins out of games that had a winner. Wall games are left out."
          />
          <Metric
            label="Wall-game rate"
            value={fmtPct(o.wallRate)}
            detail={`${fmtNum(o.wall)} of ${fmtNum(o.total)} games`}
            explain="Games where the wall ran out and nobody won."
          />
          <Metric
            label="Recent decisive win rate"
            value={fmtPct(recent.rate)}
            detail={
              recent.sample < recent.window
                ? `${recent.wins} of ${recent.sample} decided games (all so far)`
                : `${recent.wins} of the last ${recent.window} decided games`
            }
            explain={`Last ${recent.window} decided games, walls skipped. All-time is ${fmtPct(o.decisiveRate)}. A small window swings a lot.`}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* Outcome breakdown */}
        <Card title="Game outcomes" subtitle={`${fmtNum(o.total)} games`}>
          <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={`${o.win} wins, ${o.loss} losses, ${o.wall} wall games`}>
            {OUTCOMES.map((k) =>
              o[k] ? (
                <motion.div
                  key={k}
                  initial={{ width: 0 }}
                  animate={{ width: `${(o[k] / o.total) * 100}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  className={OUTCOME_META[k].dot}
                  title={`${OUTCOME_META[k].label}: ${o[k]} (${fmtPct(ratio(o[k], o.total))})`}
                />
              ) : null,
            )}
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {OUTCOMES.map((k) => (
                <tr key={k} className="border-b border-maroon-900/5 last:border-0">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <span className={`inline-block h-3 w-3 rounded-sm ${OUTCOME_META[k].dot}`} aria-hidden />
                      <span aria-hidden>{OUTCOME_META[k].emoji}</span>
                      {k === "win" ? "Wins" : k === "loss" ? "Losses" : "Wall games"}
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{fmtNum(o[k])}</td>
                  <td className="w-16 py-1.5 text-right tabular-nums text-maroon-900/75">{fmtPct(ratio(o[k], o.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Outcomes over time */}
        <Card
          title="Results over time"
          subtitle={
            chart === "dates"
              ? `Last ${s.byDate.length} playing dates`
              : chart === "months"
                ? "Games each month"
                : "Decisive win rate each month"
          }
        >
          <div className="mb-3">
            <Segmented
              size="sm"
              label="Chart view"
              value={chart}
              onChange={setChart}
              options={[
                { value: "dates" as Chart, label: "Playing dates" },
                { value: "months" as Chart, label: "Months" },
                { value: "rate" as Chart, label: "Win rate" },
              ]}
            />
          </div>
          <button
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="mb-2 min-h-11 px-1 text-sm font-semibold text-maroon-700 underline underline-offset-2"
          >
            {asTable ? "Show as a chart" : "Show as a table"}
          </button>
          {asTable ? (
            <BucketTable buckets={chart === "dates" ? s.byDate : s.byMonth} rate={chart === "rate"} />
          ) : chart === "rate" ? (
            <RateBars buckets={s.byMonth} />
          ) : (
            <>
              <StackedBars buckets={chart === "dates" ? s.byDate : s.byMonth} />
              <div className="mt-2">
                <Legend />
              </div>
            </>
          )}
        </Card>

        {/* Sections: completion vs wins */}
        <Card title="Section progress" subtitle={`${CARD_YEAR} card · hands won at least once, and total wins`}>
          <div className="mb-1 flex items-center gap-3 text-xs font-semibold text-maroon-900/70">
            <span className="w-28 shrink-0 sm:w-36">Section</span>
            <span className="flex-1">Hands won</span>
            <span className="w-12 text-right">Hands</span>
            <span className="w-12 text-right">Wins</span>
          </div>
          <div className="space-y-2">
            {s.sections.map((sec) => {
              const pct = sec.total ? (sec.wonHands / sec.total) * 100 : 0;
              const done = sec.total > 0 && sec.wonHands >= sec.total;
              return (
                <div key={sec.id} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-sm leading-tight text-maroon-900 sm:w-36">{sec.name}</div>
                  <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-cream-200">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      className={`h-full rounded-full ${done ? "bg-gold" : "bg-maroon-600"}`}
                    />
                  </div>
                  <div className="w-12 text-right text-sm font-semibold tabular-nums text-maroon-900">
                    {sec.wonHands}/{sec.total}
                    {done && <span className="sr-only"> complete</span>}
                  </div>
                  <div className="w-12 text-right text-sm tabular-nums text-maroon-900/80">{sec.wins}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-maroon-900/70">
            Hands = different hands won at least once. Wins = every win in that section, repeats included. Gold bars are
            complete sections.
          </p>
        </Card>

        {/* Most-won hands */}
        <Card collapsible title="Most-won hands" subtitle="By number of recorded wins">
          {s.top.length === 0 ? (
            <p className="text-sm text-maroon-900/75">No wins yet.</p>
          ) : (
            <ol className="space-y-2">
              {s.top.map((t, i) => (
                <li key={t.hand.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-maroon-900/5">
                  <span className="w-5 text-center font-display text-sm font-bold text-maroon-700">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <HandPattern hand={t.hand} className="text-sm font-extrabold" />
                    <span className="text-xs text-maroon-900/70">{t.sectionName}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-maroon-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-maroon-800">
                    {t.wins} win{t.wins === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-maroon-900/70">
            Counts only. The diary doesn&apos;t track which hand you were going for, so there&apos;s no success rate per hand.
          </p>
        </Card>

        {/* Rounds */}
        <Card collapsible title="Scramble rounds" subtitle="Only rounds tracked with the 4-game round feature">
          {r.completed === 0 ? (
            <div className="rounded-2xl bg-cream-100 p-4 text-sm text-maroon-900/85">
              <p className="font-semibold text-maroon-900">No completed rounds yet.</p>
              <p className="mt-1">
                A round counts once all 4 of its games are logged.
                {r.incomplete > 0 && ` ${r.incomplete} round${r.incomplete === 1 ? " is" : "s are"} in progress or ended early.`}{" "}
                Earlier games stay as individual games and are never grouped into made-up rounds.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Completed rounds" value={fmtNum(r.completed)} detail={r.incomplete ? `${r.incomplete} incomplete not counted` : undefined} explain="Rounds with all 4 games logged." />
              <Metric
                label="Avg wins per round"
                value={r.avgWinsPerCompleted === null ? "—" : r.avgWinsPerCompleted.toFixed(2)}
                detail={`${r.winsInCompleted} wins in ${r.completed} rounds`}
                explain="Wins in completed rounds ÷ completed rounds."
              />
              <Metric
                label="Rounds with a win"
                value={fmtPct(ratio(r.completedWithWin, r.completed), 0)}
                detail={`${r.completedWithWin} of ${r.completed}`}
                explain="Completed rounds where you won at least one game."
              />
              <Metric
                label="Rounds with 2+ wins"
                value={fmtPct(ratio(r.completedMultiWin, r.completed), 0)}
                detail={`${r.completedMultiWin} of ${r.completed}`}
                explain="Completed rounds where you won two or more games."
              />
            </div>
          )}
          <p className="mt-3 text-xs text-maroon-900/75">
            {fmtNum(singleGames)} game{singleGames === 1 ? "" : "s"} logged outside a round (including all games from before rounds existed).
          </p>
        </Card>

        {/* Optional details */}
        <Card collapsible title="Win details" subtitle="Jokers, self-drawn and blanks">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Metric
              label="Self-drawn wins"
              value={d.trackedWins ? fmtPct(ratio(d.selfDrawn, d.trackedWins), 0) : "—"}
              detail={d.trackedWins ? `${d.selfDrawn} of ${d.trackedWins} tracked wins` : "None tracked yet"}
              explain="Wins where you drew the Mahjong tile yourself."
            />
            <Metric
              label="No-joker wins"
              value={d.jokerEligibleTracked ? fmtPct(ratio(d.noJokers, d.jokerEligibleTracked), 0) : "—"}
              detail={d.jokerEligibleTracked ? `${d.noJokers} of ${d.jokerEligibleTracked} tracked wins` : "None tracked yet"}
              explain="Leaves out Singles & Pairs, which never use jokers."
            />
            <Metric
              label="Games with blanks"
              value={d.trackedGames ? fmtPct(ratio(d.blanksGames, d.trackedGames), 0) : "—"}
              detail={d.trackedGames ? `${d.blanksGames} of ${d.trackedGames} tracked games` : "None tracked yet"}
              explain="Single games only. Scramble and tournament games never use blanks."
            />
          </div>
          {d.untrackedWins > 0 && (
            <p className="mt-3 rounded-xl bg-cream-100 px-3 py-2 text-xs text-maroon-900/85">
              Tracking starts with newer games. {fmtNum(d.untrackedWins)} earlier win{d.untrackedWins === 1 ? " was" : "s were"} logged
              before these questions existed, so they&apos;re left out here instead of counted as &ldquo;no.&rdquo;
            </p>
          )}
        </Card>

        {/* Tournament */}
        <Card collapsible title="Tournament" subtitle="Single games played under tournament scoring" className="lg:col-span-2">
          {s.tour.totals.total === 0 ? (
            <div className="rounded-2xl bg-cream-100 p-4 text-base text-maroon-900/85">
              <p>
                No tournament games yet. Tournament games are single games where discarding the winning tile costs{" "}
                {DISCARD_PENALTY} points.
              </p>
              <button
                onClick={onStartTournament}
                className="mt-3 min-h-12 rounded-full px-5 text-base font-semibold text-maroon-700 ring-1 ring-maroon-300 hover:bg-maroon-50"
              >
                Switch Today to Tournament
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric
                label="Tournament points"
                value={fmtNum(s.tour.points.net)}
                detail={`${fmtNum(s.tour.points.handPoints)} won − ${fmtNum(s.tour.points.penaltyPoints)} discards`}
                explain="Winning hands minus 10 each time you threw the winning tile."
              />
              <Metric
                label="Games"
                value={fmtNum(s.tour.totals.total)}
                detail={`${s.tour.totals.win} wins · ${s.tour.totals.loss} losses · ${s.tour.totals.wall} walls`}
                explain="Every tournament game logged."
              />
              <Metric
                label="Decisive win rate"
                value={fmtPct(s.tour.totals.decisiveRate)}
                detail={`${s.tour.totals.win} of ${s.tour.totals.decided} decided games`}
                explain="Tournament wins out of games that had a winner."
              />
              <Metric
                label="Threw the winner"
                value={fmtNum(s.tour.points.penalties)}
                detail={`of ${s.tour.totals.loss} tournament losses`}
                explain="Losses where you discarded the winning tile."
              />
            </div>
          )}
        </Card>

        {/* Card-year recap */}
        <Card collapsible title={`Your ${CARD_YEAR} Mahj Diary`} subtitle={`Everything played with the ${CARD_YEAR} NMJL card`} className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Games", value: fmtNum(s.cardO.total) },
              { label: "Wins", value: fmtNum(s.cardO.win) },
              { label: "Unique hands won", value: `${s.progress.won} of ${s.progress.total}` },
              { label: "Card complete", value: `${Math.round(s.progress.pct * 100)}%` },
              { label: "Sections complete", value: `${s.progress.sectionsComplete.length} of ${s.sections.length}` },
              { label: "Points", value: fmtNum(s.cardPoints) },
            ].map((t) => (
              <div key={t.label} className="rounded-2xl bg-cream-100 p-3 ring-1 ring-maroon-900/5">
                <div className="font-display text-xl font-bold tabular-nums text-maroon-700">{t.value}</div>
                <div className="text-xs font-semibold text-maroon-900/75">{t.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 text-sm text-maroon-900/85 sm:flex-row sm:items-center sm:justify-between">
            {s.cardTop && (
              <p className="flex flex-wrap items-center gap-x-2">
                Most-won hand:
                <HandPattern hand={s.cardTop.hand} className="font-extrabold" />
                <span className="text-maroon-900/75">({s.cardTop.wins} wins)</span>
              </p>
            )}
            <p className="text-xs text-maroon-900/75">
              Milestones reached:{" "}
              {MILESTONES.filter((m) => s.progress.won >= m).map((m) => (m === 1 ? "first hand" : `${m} hands`)).join(" · ") ||
                "none yet"}
              {s.progress.sectionsComplete.length > 0 && ` · ${s.progress.sectionsComplete.join(", ")} complete`}
            </p>
          </div>
        </Card>

        {/* Recent activity */}
        <Card collapsible title="Recent activity" subtitle="Latest 10 games" className="lg:col-span-2">
          <ul className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
            {s.activity.map((a) => (
              <GameRow
                key={a.record.id ?? a.record.won_at}
                game={a.record}
                meta={a.sectionName || undefined}
                showDate
                onRemove={removeGame}
              />
            ))}
          </ul>
        </Card>
      </div>

      <p className="px-1 text-center text-xs text-maroon-900/70">
        Scoring: hand value from the card, +{JOKERLESS_BONUS} for no jokers (not Singles &amp; Pairs), +{SELF_DRAWN_BONUS} for
        self-drawn, and −{DISCARD_PENALTY} for discarding the winning tile in a tournament. Wins logged before those details were
        tracked count at the hand&apos;s base value.
      </p>
    </div>
  );
}
