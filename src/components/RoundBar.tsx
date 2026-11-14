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
import { Segmented } from "@/components/Segmented";
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
        <span className="absolute -right-1 -top-1 rounded-full bg-tile-red px-1 text-xs font-bold leading-4 text-white">
          −{DISCARD_PENALTY}
        </span>
      )}
    </motion.span>
  );
}

// Four slots for a round. Each saved game shows its outcome as an icon and,
// at full size, as a word too, so it never depends on color alone.
export function RoundSlots({ games, size = "md" }: { games: GameRecord[]; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-7 w-7 text-xs" : "h-10 w-10 text-base";
  return (
    <ol className="flex items-start gap-1.5" aria-label="Games in this round">
      {Array.from({ length: GAMES_PER_ROUND }).map((_, i) => {
        const g = games[i];
        return (
          <li key={g?.id ?? i} className="flex flex-col items-center gap-0.5">
            {g ? (
              <OutcomeChip game={g} label={`Game ${i + 1}`} dim={dim} />
            ) : (
              <span
                role="img"
                aria-label={`Game ${i + 1}: not played yet`}
                className={`${dim} flex items-center justify-center rounded-lg border-2 border-dashed border-maroon-900/30 font-semibold text-maroon-900/60`}
              >
                {size === "md" ? i + 1 : ""}
              </span>
            )}
            {size === "md" && (
              <span aria-hidden className="text-xs text-maroon-900/80">
                {g ? (g.outcome === "wall" ? "Wall" : OUTCOME_META[g.outcome].label) : "—"}
              </span>
            )}
          </li>
        );
      })}
    </ol>
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
  onEndRound: (roundId: string) => void; // asks for confirmation first
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
  onWall: () => void;
  onRemove: (game: GameRecord) => void; // asks for confirmation first
  onRecap: () => void;
}

const BTN =
  "flex min-h-14 flex-col items-center justify-center rounded-2xl text-base font-semibold ring-1 transition-colors";

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
    hint = `${todaySingles.length} today. Not part of a scramble round.`;
  } else if (mode === "tournament") {
    title = "Tournament";
    hint = `${todayTournament.length} game${todayTournament.length === 1 ? "" : "s"} today · ${tournamentPoints} points`;
  } else if (finished === "complete") {
    title = `Round ${roundNo} complete`;
    hint = `All ${GAMES_PER_ROUND} games saved. Your next game starts Round ${nextRoundNumber}.`;
  } else if (finished === "ended") {
    title = `Round ${roundNo} ended early`;
    hint = `${games.length} of ${GAMES_PER_ROUND} games saved. Your next game starts Round ${nextRoundNumber}.`;
  } else if (games.length === 0) {
    title = `Round ${roundNo} · not started`;
    hint = "It starts when you save your next game.";
  } else {
    title = `Round ${roundNo} · Game ${games.length + 1} of ${GAMES_PER_ROUND}`;
    hint = `${games.length} of ${GAMES_PER_ROUND} games saved so far.`;
  }

  const chips = (mode === "tournament" ? todayTournament : todaySingles).slice(-8);
  const canEnd = mode === "scramble" && currentRound && currentRound.games.length > 0;
  const recent = [...props.todayGames].reverse();
  const listed = showAll ? recent : recent.slice(0, 3);

  return (
    <section aria-labelledby="today-title" className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="today-title" className="font-display text-xl font-bold text-maroon-800">
          Today
        </h2>
        <p className="text-base text-maroon-900/80">
          {today.total === 0
            ? "No games yet today"
            : `${today.total} game${today.total === 1 ? "" : "s"} · ${today.win} win${today.win === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="mt-2">
        <p id="mode-label" className="text-sm font-semibold text-maroon-900/85">
          How are you playing?
        </p>
        <div className="mt-1 grid grid-cols-3 gap-1 rounded-2xl bg-cream-200 p-1 ring-1 ring-maroon-900/10" role="radiogroup" aria-labelledby="mode-label">
          {MODE_OPTIONS.map((o) => {
            const active = o.value === mode;
            return (
              <button
                key={o.value}
                role="radio"
                aria-checked={active}
                onClick={() => onMode(o.value)}
                className={`min-h-11 rounded-xl px-1 text-sm font-semibold transition-colors sm:text-base ${
                  active ? "bg-maroon-700 text-cream-50 shadow-sm" : "text-maroon-800 hover:bg-cream-100"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-cream-100 p-3 ring-1 ring-maroon-900/5">
        <div aria-live="polite">
          <p className="font-display text-lg font-bold text-maroon-800">{title}</p>
          <p className="text-sm text-maroon-900/80">{hint}</p>
        </div>
        {mode === "single" && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-maroon-900/85">Your next game is with</span>
            <Segmented label="Blanks for your next single game" value={props.singleBlanks} onChange={props.onSingleBlanks} options={BLANKS_OPTIONS} size="sm" />
          </div>
        )}
        {mode === "tournament" && (
          <p className="mt-1 text-sm text-maroon-900/80">
            Single games with tournament scoring. Discarding the winning tile costs {DISCARD_PENALTY} points.
          </p>
        )}
        <div className="mt-2.5 flex min-h-11 flex-wrap items-center gap-1.5">
          {mode === "scramble" ? (
            <RoundSlots games={games} />
          ) : chips.length === 0 ? (
            <span className="text-sm text-maroon-900/75">
              No {mode === "tournament" ? "tournament" : "single"} games yet today.
            </span>
          ) : (
            chips.map((g, i) => <OutcomeChip key={g.id ?? i} game={g} label="Game" dim="h-10 w-10 text-base" />)
          )}
          {canEnd && (
            <button
              onClick={() => props.onEndRound(currentRound!.round.id)}
              className="ml-auto min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-maroon-700 ring-1 ring-maroon-300 transition-colors hover:bg-maroon-50"
            >
              End round early…
            </button>
          )}
        </div>
      </div>

      {/* Log the next game. Each button opens a review step; nothing saves until "Save". */}
      <p id="log-label" className="mt-3 text-sm font-semibold text-maroon-900/85">
        Log your next game
      </p>
      <div className="mt-1 grid grid-cols-3 gap-2" role="group" aria-labelledby="log-label">
        <button onClick={props.onWin} className={`${BTN} bg-outcome-win-soft text-outcome-win-ink ring-outcome-win/40 hover:bg-outcome-win/15`}>
          <span aria-hidden>🏆</span> Win
        </button>
        <button onClick={props.onLoss} className={`${BTN} bg-outcome-loss-soft text-outcome-loss-ink ring-outcome-loss/40 hover:bg-outcome-loss/20`}>
          <span aria-hidden>❌</span> Loss
        </button>
        <button onClick={props.onWall} className={`${BTN} bg-outcome-wall-soft text-outcome-wall-ink ring-outcome-wall/40 hover:bg-outcome-wall/20`}>
          <span aria-hidden>🧱</span> Wall game
        </button>
      </div>
      {recent.length === 0 && (
        <p className="mt-2 text-sm text-maroon-900/80">
          After your first game, tap how it ended. You&apos;ll get a chance to check it before it&apos;s saved.
        </p>
      )}

      {/* Today's games, newest first. The place to fix a mistake after the fact. */}
      {recent.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="card-title">Today&apos;s games</h3>
            <button onClick={props.onRecap} className="min-h-11 px-1 text-sm font-semibold text-maroon-700 underline underline-offset-2">
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
              className="mt-1 min-h-11 px-1 text-sm font-semibold text-maroon-700 underline underline-offset-2"
            >
              {showAll ? "Show fewer" : `Show all ${recent.length} games`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
