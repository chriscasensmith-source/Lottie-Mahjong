"use client";

import { motion } from "framer-motion";
import type { GameRecord } from "@/lib/types";
import { GAMES_PER_ROUND, type RoundView, handById, gamePoints } from "@/lib/stats";
import { OUTCOME_META } from "@/lib/outcomes";
import { Segmented } from "@/components/WinSheet";

// Four slots for a round, each filled with that game's outcome color + icon.
export function RoundSlots({ games, size = "md" }: { games: GameRecord[]; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6 text-[11px]" : "h-9 w-9 text-sm";
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: GAMES_PER_ROUND }).map((_, i) => {
        const g = games[i];
        if (!g) {
          return (
            <span
              key={i}
              className={`${dim} rounded-lg border-2 border-dashed border-maroon-900/15`}
              title={`Game ${i + 1}: not played yet`}
            />
          );
        }
        const meta = OUTCOME_META[g.outcome];
        const hand = g.hand_id ? handById(g.hand_id) : null;
        return (
          <motion.span
            key={g.id ?? i}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className={`${dim} ${meta.dot} flex items-center justify-center rounded-lg text-white shadow-sm`}
            title={`Game ${i + 1}: ${meta.label}${hand ? ` · ${gamePoints(g)} pts` : ""}`}
          >
            {meta.emoji}
          </motion.span>
        );
      })}
    </div>
  );
}

interface RoundBarProps {
  currentRound: RoundView | null;
  nextRoundNumber: number;
  pendingBlanks: boolean;
  onPendingBlanks: (b: boolean) => void;
  onToggleBlanks: (roundId: string, blanks: boolean) => void;
  onLoss: () => void;
  onWall: () => void;
  onNewRound: () => void;
}

export function RoundBar({
  currentRound,
  nextRoundNumber,
  pendingBlanks,
  onPendingBlanks,
  onToggleBlanks,
  onLoss,
  onWall,
  onNewRound,
}: RoundBarProps) {
  const games = currentRound?.games ?? [];
  const blanks = currentRound ? currentRound.round.blanks : pendingBlanks;
  const nextGame = games.length + 1;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Current round"
      className="w-full max-w-2xl rounded-3xl bg-cream-50 p-4 text-left shadow-sm ring-1 ring-maroon-900/10 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-maroon-900/50">
            Today
          </p>
          <h2 className="font-display text-xl font-bold text-maroon-800">
            Round {nextRoundNumber}
            <span className="ml-2 text-sm font-medium text-maroon-900/55">
              {currentRound
                ? `Game ${Math.min(nextGame, GAMES_PER_ROUND)} of ${GAMES_PER_ROUND} is next`
                : "starts with your next game"}
            </span>
          </h2>
        </div>
        <Segmented
          label="Blanks"
          value={blanks}
          onChange={(b) =>
            currentRound ? onToggleBlanks(currentRound.round.id, b) : onPendingBlanks(b)
          }
          options={[
            { value: false, label: "No blanks" },
            { value: true, label: "Blanks" },
          ]}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <RoundSlots games={games} />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onLoss}
            className="rounded-full bg-outcome-loss-soft px-3.5 py-2 text-sm font-semibold text-outcome-loss-ink ring-1 ring-outcome-loss/30 transition-colors hover:bg-outcome-loss/20"
          >
            ❌ Log loss
          </button>
          <button
            onClick={onWall}
            className="rounded-full bg-outcome-wall-soft px-3.5 py-2 text-sm font-semibold text-outcome-wall-ink ring-1 ring-outcome-wall/30 transition-colors hover:bg-outcome-wall/20"
          >
            🧱 Wall game
          </button>
          {currentRound && games.length > 0 && (
            <button
              onClick={onNewRound}
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
