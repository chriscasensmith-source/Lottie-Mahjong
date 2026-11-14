"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { GameRecord, PlayMode } from "@/lib/types";
import {
  DISCARD_PENALTY,
  GAMES_PER_ROUND,
  type OutcomeTotals,
  type RoundView,
  handById,
  gamePoints,
} from "@/lib/stats";
import { OUTCOME_META } from "@/lib/outcomes";
import { Segmented } from "@/components/WinSheet";
import { GameRow } from "@/components/GameRow";

// One small outcome square (color + icon), used for round slots and single games.
function OutcomeChip({ game, label, dim }: { game: GameRecord; label: string; dim: string }) {
  const meta = OUTCOME_META[game.outcome];
  const hand = game.hand_id ? handById(game.hand_id) : null;
  const pts = gamePoints(game);
  const text = `${label}: ${meta.label}${hand || pts ? `, ${pts} points` : ""}`;
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={`${dim} ${meta.dot} relative flex shrink-0 items-center justify-center rounded-lg text-white shadow-sm`}
      title={text}
      role="img"
      aria-label={text}
    >
      {meta.emoji}
      {game.discarded_winner && (
        <span className="absolute -right-1 -top-1 rounded-full bg-tile-red px-1 text-[9px] font-bold leading-4 text-white">
          −{DISCARD_PENALTY}
        </span>
      )}
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

export const MODE_OPTIONS = [
  { value: "scramble" as PlayMode, label: "Scramble" },
  { value: "single" as PlayMode, label: "Single games" },
  { value: "tournament" as PlayMode, label: "Tournament" },
];

interface RoundBarProps {
  mode: PlayMode;
  onMode: (m: PlayMode) => void;
  // scramble
  todayRound: RoundView | null; // latest round today, whatever its state
  currentRound: RoundView | null; // the round the next game joins
  nextRoundNumber: number;
  onEndRound: (roundId: string) => void;
  // single games
  singleBlanks: boolean;
  onSingleBlanks: (b: boolean) => void;
  todaySingles: GameRecord[];
  // tournament
  todayTournament: GameRecord[];
  // all modes
  today: OutcomeTotals;
  todayGames: GameRecord[]; // every game today, oldest first
  onWin: () => void;
  onLoss: () => void;
  onThrew: () => void;
  onWall: () => void;
  onRemove: (game: GameRecord) => void; // asks for confirmation first
  onRecap: () => void;
}

const BTN = "flex min-h-12 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold ring-1 transition-colors";

export function RoundBar(props: RoundBarProps) {
  const { mode, onMode, todayRound, currentRound, nextRoundNumber, todaySingles, todayTournament, today } = props;
  const [showAll, setShowAll] = useState(false);

  // Scramble: the open round, or today's last finished one until the next
  // game starts a new round.
  const shown = currentRound ?? todayRound;
  const games = shown?.games ?? [];
  const finished = !currentRound && todayRound ? todayRound.status : null; // "complete" | "ended"
  const roundNo = shown?.number ?? nextRoundNumber;
  const tournamentPoints = todayTournament.reduce((s, g) => s + gamePoints(g), 0);

  let title: string;
  let hint: string;
  if (mode === "single") {
    title = "Single games";
    hint = `${todaySingles.length} today · not part of a scramble`;
  } else if (mode === "tournament") {
    title = "Tournament";
    hint = `${todayTournament.length} game${todayTournament.length === 1 ? "" : "s"} today · ${tournamentPoints} pts`;
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

  const chips = (mode === "tournament" ? todayTournament : todaySingles).slice(-8);
  const canEnd = mode === "scramble" && currentRound && currentRound.games.length > 0;
  const recent = [...props.todayGames].reverse();
  const listed = showAll ? recent : recent.slice(0, 3);

  return (
    <section aria-label="Today" className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-lg font-bold text-maroon-800">Today</h2>
          <p className="text-sm text-maroon-900/75">
            {today.total === 0
              ? "No games yet"
              : `${today.total} game${today.total === 1 ? "" : "s"} · ${today.win} win${today.win === 1 ? "" : "s"}`}
          </p>
        </div>
        <Segmented size="sm" label="How you're playing" value={mode} onChange={onMode} options={MODE_OPTIONS} />
      </div>

      <div className="mt-3 rounded-2xl bg-cream-100 p-3 ring-1 ring-maroon-900/5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div aria-live="polite">
            <p className="font-display text-base font-bold text-maroon-800">{title}</p>
            <p className="text-xs text-maroon-900/75">{hint}</p>
          </div>
          {mode === "single" && (
            <Segmented label="Blanks for this game" value={props.singleBlanks} onChange={props.onSingleBlanks} options={BLANKS_OPTIONS} size="sm" />
          )}
        </div>
        <div className="mt-2.5 flex min-h-10 items-center gap-1.5 overflow-x-auto pt-1">
          {mode === "scramble" ? (
            <RoundSlots games={games} />
          ) : chips.length === 0 ? (
            <span className="text-xs text-maroon-900/70">
              No {mode === "tournament" ? "tournament" : "single"} games yet today.
            </span>
          ) : (
            chips.map((g, i) => <OutcomeChip key={g.id ?? i} game={g} label="Game" dim="h-10 w-10 text-base" />)
          )}
          {canEnd && (
            <button
              onClick={() => props.onEndRound(currentRound!.round.id)}
              className="ml-auto min-h-10 shrink-0 rounded-full px-3 text-xs font-semibold text-maroon-700 ring-1 ring-maroon-300 transition-colors hover:bg-maroon-50"
              title="Stop this round here. It's kept as an incomplete round."
            >
              End round early
            </button>
          )}
        </div>
      </div>

      {/* Log a game: win, loss, wall (and, in a tournament, throwing the winner) */}
      <div className={`mt-3 grid gap-2 ${mode === "tournament" ? "grid-cols-2" : "grid-cols-3"}`}>
        <button onClick={props.onWin} className={`${BTN} bg-outcome-win-soft text-outcome-win-ink ring-outcome-win/30 hover:bg-outcome-win/15`}>
          🏆 Win
        </button>
        <button onClick={props.onLoss} className={`${BTN} bg-outcome-loss-soft text-outcome-loss-ink ring-outcome-loss/30 hover:bg-outcome-loss/20`}>
          ❌ Loss
        </button>
        {mode === "tournament" && (
          <button
            onClick={props.onThrew}
            className={`${BTN} bg-maroon-50 text-maroon-800 ring-maroon-300 hover:bg-maroon-100`}
            aria-label={`Loss, and I discarded the winning tile, minus ${DISCARD_PENALTY} points`}
          >
            🫳 I threw it <span className="text-xs font-bold text-tile-red">−{DISCARD_PENALTY}</span>
          </button>
        )}
        <button onClick={props.onWall} className={`${BTN} bg-outcome-wall-soft text-outcome-wall-ink ring-outcome-wall/30 hover:bg-outcome-wall/20`}>
          🧱 Wall
        </button>
      </div>

      {/* Today's games, newest first, each removable (with a confirmation) */}
      {recent.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="card-title">Today&apos;s games</p>
            <button onClick={props.onRecap} className="text-xs font-semibold text-maroon-700 underline underline-offset-2">
              Today&apos;s recap
            </button>
          </div>
          <ul className="space-y-1.5">
            {listed.map((g) => (
              <GameRow key={g.id ?? g.won_at} game={g} onRemove={props.onRemove} />
            ))}
          </ul>
          {recent.length > 3 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-1.5 min-h-9 text-xs font-semibold text-maroon-700 underline underline-offset-2"
            >
              {showAll ? "Show fewer" : `Show all ${recent.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
