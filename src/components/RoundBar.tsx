"use client";

import { motion } from "framer-motion";
import type { GameRecord, Hand, PlayMode } from "@/lib/types";
import {
  GAMES_PER_ROUND,
  type HandStat,
  type OutcomeTotals,
  type RoundView,
  handById,
  gamePoints,
} from "@/lib/stats";
import { OUTCOME_META } from "@/lib/outcomes";
import { Segmented } from "@/components/WinSheet";
import { HandPattern } from "@/components/HandCard";

// One small outcome square (color + icon), used for round slots and single games.
function OutcomeChip({ game, label, dim }: { game: GameRecord; label: string; dim: string }) {
  const meta = OUTCOME_META[game.outcome];
  const hand = game.hand_id ? handById(game.hand_id) : null;
  const text = `${label}: ${meta.label}${hand ? `, ${gamePoints(game)} points` : ""}`;
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={`${dim} ${meta.dot} flex items-center justify-center rounded-lg text-white shadow-sm`}
      title={text}
      role="img"
      aria-label={text}
    >
      {meta.emoji}
    </motion.span>
  );
}

// Four slots for a round, each filled with that game's outcome color + icon.
export function RoundSlots({ games, size = "md" }: { games: GameRecord[]; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6 text-[11px]" : "h-10 w-10 text-base";
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: GAMES_PER_ROUND }).map((_, i) => {
        const g = games[i];
        return g ? (
          <OutcomeChip key={g.id ?? i} game={g} label={`Game ${i + 1}`} dim={dim} />
        ) : (
          <span
            key={i}
            role="img"
            aria-label={`Game ${i + 1}: not played yet`}
            className={`${dim} flex items-center justify-center rounded-lg border-2 border-dashed border-maroon-900/25 text-[11px] font-semibold text-maroon-900/60`}
          >
            {size === "md" ? i + 1 : ""}
          </span>
        );
      })}
    </div>
  );
}

const BLANKS_OPTIONS = [
  { value: false, label: "No blanks" },
  { value: true, label: "Blanks" },
];

interface RoundBarProps {
  mode: PlayMode;
  onMode: (m: PlayMode) => void;
  // rounds mode
  todayRound: RoundView | null; // latest round today, whatever its state
  currentRound: RoundView | null; // the round the next game joins
  nextRoundNumber: number;
  pendingBlanks: boolean;
  onPendingBlanks: (b: boolean) => void;
  onToggleBlanks: (roundId: string, blanks: boolean) => void;
  onEndRound: (roundId: string) => void;
  // single-games mode
  singleBlanks: boolean;
  onSingleBlanks: (b: boolean) => void;
  todaySingles: GameRecord[];
  // both
  today: OutcomeTotals;
  quickHands: HandStat[];
  onQuickWin: (hand: Hand) => void;
  onLoss: () => void;
  onWall: () => void;
  onRecap: () => void;
}

export function RoundBar(props: RoundBarProps) {
  const { mode, onMode, todayRound, currentRound, nextRoundNumber, todaySingles, today } = props;
  const single = mode === "single";

  // What the round area shows: the open round, or today's last finished one
  // until the next game starts a new round.
  const shown = currentRound ?? todayRound;
  const games = shown?.games ?? [];
  const finished = !currentRound && todayRound ? todayRound.status : null; // "complete" | "ended"
  const roundNo = shown?.number ?? nextRoundNumber;

  let title: string;
  let hint: string;
  if (single) {
    title = "Single games";
    hint = `${todaySingles.length} today · not part of a round`;
  } else if (finished === "complete") {
    title = `Round ${roundNo} complete`;
    hint = `${GAMES_PER_ROUND} of ${GAMES_PER_ROUND} games · your next game starts Round ${nextRoundNumber}`;
  } else if (finished === "ended") {
    title = `Round ${roundNo} ended early`;
    hint = `${games.length} of ${GAMES_PER_ROUND} games · your next game starts Round ${nextRoundNumber}`;
  } else {
    title = `Round ${roundNo}`;
    hint = `${games.length} of ${GAMES_PER_ROUND} games${games.length === 0 ? " · starts with your next game" : ""}`;
  }

  const roundBlanks = currentRound ? currentRound.round.blanks : props.pendingBlanks;
  const shownSingles = todaySingles.slice(-8);
  const canEnd = !single && currentRound && currentRound.games.length > 0;

  return (
    <section aria-label="Today" className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-lg font-bold text-maroon-800">Today</h2>
          <p className="text-sm text-maroon-900/75">
            {today.total === 0
              ? "No games yet"
              : `${today.total} game${today.total === 1 ? "" : "s"} · ${today.win} win${today.win === 1 ? "" : "s"}`}
          </p>
        </div>
        <Segmented
          size="sm"
          label="How you're playing"
          value={mode}
          onChange={onMode}
          options={[
            { value: "rounds" as PlayMode, label: "Rounds" },
            { value: "single" as PlayMode, label: "Single games" },
          ]}
        />
      </div>

      <div className="mt-3 rounded-2xl bg-cream-100 p-3 ring-1 ring-maroon-900/5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div aria-live="polite">
            <p className="font-display text-base font-bold text-maroon-800">{title}</p>
            <p className="text-xs text-maroon-900/75">{hint}</p>
          </div>
          {single ? (
            <Segmented label="Blanks for this game" value={props.singleBlanks} onChange={props.onSingleBlanks} options={BLANKS_OPTIONS} size="sm" />
          ) : (
            <Segmented
              size="sm"
              label={currentRound ? "Blanks for this round" : "Blanks for the next round"}
              value={roundBlanks}
              onChange={(b) => (currentRound ? props.onToggleBlanks(currentRound.round.id, b) : props.onPendingBlanks(b))}
              options={BLANKS_OPTIONS}
            />
          )}
        </div>
        <div className="mt-2.5 flex min-h-10 items-center gap-1.5">
          {single ? (
            shownSingles.length === 0 ? (
              <span className="text-xs text-maroon-900/70">No single games yet today.</span>
            ) : (
              shownSingles.map((g, i) => <OutcomeChip key={g.id ?? i} game={g} label="Single game" dim="h-10 w-10 text-base" />)
            )
          ) : (
            <RoundSlots games={games} />
          )}
          {canEnd && (
            <button
              onClick={() => props.onEndRound(currentRound!.round.id)}
              className="ml-auto min-h-10 rounded-full px-3 text-xs font-semibold text-maroon-700 ring-1 ring-maroon-300 transition-colors hover:bg-maroon-50"
              title="Stop this round here. It's kept as an incomplete round."
            >
              End round early
            </button>
          )}
        </div>
      </div>

      {/* Fast logging */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={props.onLoss}
          className="min-h-12 rounded-2xl bg-outcome-loss-soft text-sm font-semibold text-outcome-loss-ink ring-1 ring-outcome-loss/30 transition-colors hover:bg-outcome-loss/20"
        >
          ❌ Log loss
        </button>
        <button
          onClick={props.onWall}
          className="min-h-12 rounded-2xl bg-outcome-wall-soft text-sm font-semibold text-outcome-wall-ink ring-1 ring-outcome-wall/30 transition-colors hover:bg-outcome-wall/20"
        >
          🧱 Wall game
        </button>
      </div>

      {props.quickHands.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-maroon-900/75">
            Won? Tap a recent hand, or <span className="text-maroon-700">+ Log win</span> on any card below.
          </p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
            {props.quickHands.map((h) => (
              <button
                key={h.hand.id}
                onClick={() => props.onQuickWin(h.hand)}
                aria-label={`Log a win: ${h.hand.pattern.map((p) => p.text).join(" ")}`}
                className="flex min-h-12 shrink-0 flex-col items-start justify-center rounded-xl bg-white px-3 py-1.5 text-left ring-1 ring-maroon-900/10 transition-colors hover:ring-maroon-500"
              >
                <HandPattern hand={h.hand} className="flex-nowrap whitespace-nowrap text-sm font-extrabold" />
                <span className="text-[11px] text-maroon-900/70">
                  {h.sectionName} · {h.hand.points} pts
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {today.total > 0 && (
        <button onClick={props.onRecap} className="mt-2 text-xs font-semibold text-maroon-700 underline underline-offset-2">
          See today&apos;s recap
        </button>
      )}
    </section>
  );
}
