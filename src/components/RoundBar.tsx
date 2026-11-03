"use client";

import { motion } from "framer-motion";
import type { GameRecord, PlayMode } from "@/lib/types";
import { GAMES_PER_ROUND, type RoundView, handById, gamePoints } from "@/lib/stats";
import { OUTCOME_META } from "@/lib/outcomes";
import { Segmented } from "@/components/WinSheet";

// One small outcome square (color + icon), used for round slots and single games.
function OutcomeChip({ game, label, dim }: { game: GameRecord; label: string; dim: string }) {
  const meta = OUTCOME_META[game.outcome];
  const hand = game.hand_id ? handById(game.hand_id) : null;
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={`${dim} ${meta.dot} flex items-center justify-center rounded-lg text-white shadow-sm`}
      title={`${label}: ${meta.label}${hand ? ` · ${gamePoints(game)} pts` : ""}`}
    >
      {meta.emoji}
    </motion.span>
  );
}

// Four slots for a round, each filled with that game's outcome color + icon.
export function RoundSlots({ games, size = "md" }: { games: GameRecord[]; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6 text-[11px]" : "h-9 w-9 text-sm";
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: GAMES_PER_ROUND }).map((_, i) => {
        const g = games[i];
        return g ? (
          <OutcomeChip key={g.id ?? i} game={g} label={`Game ${i + 1}`} dim={dim} />
        ) : (
          <span
            key={i}
            className={`${dim} rounded-lg border-2 border-dashed border-maroon-900/15`}
            title={`Game ${i + 1}: not played yet`}
          />
        );
      })}
    </div>
  );
}

interface RoundBarProps {
  mode: PlayMode;
  onMode: (m: PlayMode) => void;
  // rounds mode
  currentRound: RoundView | null;
  nextRoundNumber: number;
  pendingBlanks: boolean;
  onPendingBlanks: (b: boolean) => void;
  onToggleBlanks: (roundId: string, blanks: boolean) => void;
  onNewRound: () => void;
  // single-games mode
  singleBlanks: boolean;
  onSingleBlanks: (b: boolean) => void;
  todaySingles: GameRecord[];
  // both
  onLoss: () => void;
  onWall: () => void;
}

const BLANKS_OPTIONS = [
  { value: false, label: "No blanks" },
  { value: true, label: "Blanks" },
];

export function RoundBar(props: RoundBarProps) {
  const { mode, onMode, currentRound, nextRoundNumber, todaySingles } = props;
  const single = mode === "single";
  const games = currentRound?.games ?? [];
  const nextGame = games.length + 1;
  const roundBlanks = currentRound ? currentRound.round.blanks : props.pendingBlanks;
  const shownSingles = todaySingles.slice(-8);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={single ? "Single games" : "Current round"}
      className="w-full max-w-2xl rounded-3xl bg-cream-50 p-4 text-left shadow-sm ring-1 ring-maroon-900/10 sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-maroon-900/50">
          Today
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-maroon-800">
          {single ? "Single game" : `Round ${nextRoundNumber}`}
          <span className="ml-2 text-sm font-medium text-maroon-900/55">
            {single
              ? `${todaySingles.length} single game${todaySingles.length === 1 ? "" : "s"} today`
              : currentRound
                ? `Game ${Math.min(nextGame, GAMES_PER_ROUND)} of ${GAMES_PER_ROUND} is next`
                : "starts with your next game"}
          </span>
        </h2>
        {single ? (
          <Segmented
            label="Blanks for this game"
            value={props.singleBlanks}
            onChange={props.onSingleBlanks}
            options={BLANKS_OPTIONS}
          />
        ) : (
          <Segmented
            label="Blanks for this round"
            value={roundBlanks}
            onChange={(b) =>
              currentRound ? props.onToggleBlanks(currentRound.round.id, b) : props.onPendingBlanks(b)
            }
            options={BLANKS_OPTIONS}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {single ? (
          <div className="flex min-h-9 items-center gap-1.5">
            {shownSingles.length === 0 ? (
              <span className="text-xs text-maroon-900/45">No single games yet today.</span>
            ) : (
              shownSingles.map((g, i) => (
                <OutcomeChip key={g.id ?? i} game={g} label="Single game" dim="h-9 w-9 text-sm" />
              ))
            )}
          </div>
        ) : (
          <RoundSlots games={games} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={props.onLoss}
            className="rounded-full bg-outcome-loss-soft px-3.5 py-2 text-sm font-semibold text-outcome-loss-ink ring-1 ring-outcome-loss/30 transition-colors hover:bg-outcome-loss/20"
          >
            ❌ Log loss
          </button>
          <button
            onClick={props.onWall}
            className="rounded-full bg-outcome-wall-soft px-3.5 py-2 text-sm font-semibold text-outcome-wall-ink ring-1 ring-outcome-wall/30 transition-colors hover:bg-outcome-wall/20"
          >
            🧱 Wall game
          </button>
          {!single && currentRound && games.length > 0 && (
            <button
              onClick={props.onNewRound}
              title="End this round early and start a fresh one"
              className="rounded-full px-3 py-2 text-sm font-semibold text-maroon-700 ring-1 ring-maroon-300 transition-colors hover:bg-maroon-50"
            >
              ↻ New round
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-maroon-900/45">
        Won? Tap <span className="font-semibold text-maroon-700">+ Log win</span> on the hand you made below.
      </p>
    </motion.section>
  );
}
