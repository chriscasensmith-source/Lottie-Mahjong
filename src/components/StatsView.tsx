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
  ratio,
  MILESTONES,
  type OutcomeBucket,
} from "@/lib/stats";
import { OUTCOME_META } from "@/lib/outcomes";
import { HandPattern } from "@/components/HandCard";
import { GameRow } from "@/components/GameRow";
import { Segmented } from "@/components/WinSheet";
import { downloadCsv, gamesToCsv } from "@/lib/export";

const OUTCOMES: GameOutcome[] = ["win", "loss", "wall"];

function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`} aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-maroon-900/70">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
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
  return (
    <div className="rounded-2xl bg-cream-100 p-3 ring-1 ring-maroon-900/5">
      <div className="text-xs font-semibold text-maroon-900/80">{label}</div>
      <div className="font-display text-2xl font-bold tabular-nums text-maroon-700">{value}</div>
      {detail && <div className="text-xs tabular-nums text-maroon-900/80">{detail}</div>}
      <p className="mt-1 text-[11px] leading-snug text-maroon-900/70">{explain}</p>
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
          <span key={b.key} className="flex-1 text-center text-[10px] tabular-nums text-maroon-900/70">
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
                <span className="mb-0.5 text-[10px] font-semibold tabular-nums text-maroon-900/85">
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
          <span key={b.key} className="flex-1 text-center text-[10px] leading-tight text-maroon-900/70">
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
      <p className="mt-1 text-[11px] text-maroon-900/70">
        n = decided games that month. Lighter bars have fewer than 10, so treat them as rough.
      </p>
    </div>
  );
}

interface StatsViewProps {
  records: GameRecord[];
  rounds: Round[];
  removeGame: (record: GameRecord) => void;
}

type Chart = "dates" | "months" | "rate";

export function StatsView({ records, rounds, removeGame }: StatsViewProps) {
  const [chart, setChart] = useState<Chart>("dates");

  const s = useMemo(() => {
    const card = cardYearRecords(records);
    return {
      o: outcomeTotals(records),
      recent: recentDecisiveRate(records, 50),
      points: totalPoints(records),
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
        <p className="mt-3 font-display text-lg font-semibold text-maroon-800">No games logged yet</p>
        <p className="mt-1 text-sm">Log a win on a hand, or record a loss or wall game. Your stats will show up here.</p>
      </div>
    );
  }

  const singleGames = records.filter((g) => !g.round_id).length;

  function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`mahj-journal-games-${stamp}.csv`, gamesToCsv(records, rounds));
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
          { label: "Hand points", value: s.points, wide: true },
        ].map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`card p-4 ${t.wide ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <div className="font-display text-3xl font-bold tabular-nums text-maroon-700">{fmtNum(t.value)}</div>
            <div className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-maroon-900/75">{t.label}</div>
          </motion.div>
        ))}
      </div>
      <p className="-mt-1 px-1 text-xs text-maroon-900/70">
        All time. Games = wins + losses + wall games. Hand points add up the value of each winning hand.
      </p>

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
          {chart === "rate" ? (
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
          <div className="mb-1 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-maroon-900/70">
            <span className="w-28 shrink-0 sm:w-32">Section</span>
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
                  <div className="w-28 shrink-0 truncate text-sm text-maroon-900 sm:w-32">{sec.name}</div>
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
          <p className="mt-3 text-[11px] text-maroon-900/70">
            Hands = different hands won at least once. Wins = every win in that section, repeats included. Gold bars are
            complete sections.
          </p>
        </Card>

        {/* Most-won hands */}
        <Card title="Most-won hands" subtitle="By number of recorded wins">
          {s.top.length === 0 ? (
            <p className="text-sm text-maroon-900/75">No wins yet.</p>
          ) : (
            <ol className="space-y-2">
              {s.top.map((t, i) => (
                <li key={t.hand.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-maroon-900/5">
                  <span className="w-5 text-center font-display text-sm font-bold text-maroon-700">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <HandPattern hand={t.hand} className="text-sm font-extrabold" />
                    <span className="text-[11px] text-maroon-900/70">{t.sectionName}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-maroon-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-maroon-800">
                    {t.wins} win{t.wins === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-[11px] text-maroon-900/70">
            Counts only. The journal doesn&apos;t track which hand you were going for, so there&apos;s no success rate per hand.
          </p>
        </Card>

        {/* Rounds */}
        <Card title="Rounds" subtitle="Only rounds tracked with the 4-game round feature">
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
              <Metric
                label="Played with blanks"
                value={fmtNum(r.completedWithBlanks)}
                detail={`of ${r.completed} completed rounds`}
                explain="Completed rounds set to Blanks."
              />
            </div>
          )}
          <p className="mt-3 text-xs text-maroon-900/75">
            {fmtNum(singleGames)} game{singleGames === 1 ? "" : "s"} logged outside a round (including all games from before rounds existed).
          </p>
        </Card>

        {/* Optional details */}
        <Card title="Win details" subtitle="Jokers, self-drawn and blanks">
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
              explain="Round games use their round's setting."
            />
          </div>
          {d.untrackedWins > 0 && (
            <p className="mt-3 rounded-xl bg-cream-100 px-3 py-2 text-xs text-maroon-900/85">
              Tracking starts with newer games. {fmtNum(d.untrackedWins)} earlier win{d.untrackedWins === 1 ? " was" : "s were"} logged
              before these questions existed, so they&apos;re left out here instead of counted as &ldquo;no.&rdquo;
            </p>
          )}
        </Card>

        {/* Card-year recap */}
        <Card title={`Your ${CARD_YEAR} Mahj Journal`} subtitle={`Everything played with the ${CARD_YEAR} NMJL card`} className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Games", value: fmtNum(s.cardO.total) },
              { label: "Wins", value: fmtNum(s.cardO.win) },
              { label: "Unique hands won", value: `${s.progress.won} of ${s.progress.total}` },
              { label: "Card complete", value: `${Math.round(s.progress.pct * 100)}%` },
              { label: "Sections complete", value: `${s.progress.sectionsComplete.length} of ${s.sections.length}` },
              { label: "Hand points", value: fmtNum(s.cardPoints) },
            ].map((t) => (
              <div key={t.label} className="rounded-2xl bg-cream-100 p-3 ring-1 ring-maroon-900/5">
                <div className="font-display text-xl font-bold tabular-nums text-maroon-700">{t.value}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-maroon-900/75">{t.label}</div>
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
        <Card title="Recent activity" subtitle="Latest 10 games" className="lg:col-span-2">
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

      <div className="card flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-maroon-900">Back up your games</p>
          <p className="text-xs text-maroon-900/75">
            A personal CSV copy of every game: date, outcome, hand, points and round. Unknown details say &ldquo;not recorded.&rdquo;
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="min-h-10 shrink-0 rounded-full bg-maroon-700 px-4 text-sm font-semibold text-cream-50 hover:bg-maroon-800"
        >
          Export CSV
        </button>
      </div>

      <p className="px-1 text-center text-xs text-maroon-900/70">
        Points use NMJL doubling: no jokers ×2 (except Singles &amp; Pairs), self-drawn ×2. Wins logged before those details were
        tracked count at the hand&apos;s base value.
      </p>
    </div>
  );
}
