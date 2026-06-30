"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { GameOutcome, GameRecord } from "@/lib/types";

const LOCAL_KEY = "mahjong_game_records";
const LEGACY_RECORDS_KEY = "mahjong_win_records"; // wins-only records
const LEGACY_COUNTS_KEY = "mahjong_wins"; // oldest { handId: count } format

// localStorage helpers (used when Supabase env vars are absent).
function readLocal(): GameRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as GameRecord[];

    // Migrate the wins-only records format.
    const recs = window.localStorage.getItem(LEGACY_RECORDS_KEY);
    if (recs) {
      const old = JSON.parse(recs) as {
        id?: string;
        hand_id: string;
        won_at: string;
      }[];
      return old.map((r) => ({ ...r, outcome: "win" as GameOutcome }));
    }

    // Migrate the oldest { handId: count } format.
    const counts = window.localStorage.getItem(LEGACY_COUNTS_KEY);
    if (counts) {
      const map = JSON.parse(counts) as Record<string, number>;
      const now = new Date().toISOString();
      const out: GameRecord[] = [];
      for (const [hand_id, count] of Object.entries(map)) {
        for (let i = 0; i < count; i++) {
          out.push({
            id: `legacy-${hand_id}-${i}`,
            hand_id,
            outcome: "win",
            won_at: now,
          });
        }
      }
      return out;
    }
    return [];
  } catch {
    return [];
  }
}

function writeLocal(records: GameRecord[]) {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
}

function tempId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseWins {
  records: GameRecord[];
  /** Wins per hand id. */
  counts: Record<string, number>;
  loading: boolean;
  totalWins: number;
  totalLosses: number;
  totalWalls: number;
  totalGames: number;
  /** Distinct hands won at least once. */
  playedCount: number;
  logWin: (handId: string) => Promise<void>;
  logLoss: () => Promise<void>;
  logWall: () => Promise<void>;
  /** Remove the most recent win for a hand. */
  undoWin: (handId: string) => Promise<void>;
  /** Remove a specific game record (used by the activity feed). */
  removeGame: (record: GameRecord) => Promise<void>;
  backend: "supabase" | "local";
}

export function useWins(): UseWins {
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const backend = isSupabaseConfigured ? "supabase" : "local";

  // Mirror of latest records so callbacks read current state without going stale.
  const recordsRef = useRef<GameRecord[]>([]);
  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  // Initial load.
  useEffect(() => {
    let active = true;
    async function load() {
      if (supabase) {
        const query = supabase
          .from("mahjong_wins")
          .select("id, hand_id, won_at, outcome")
          .order("won_at", { ascending: true });
        const timeout = new Promise<{ timedOut: true }>((resolve) =>
          setTimeout(() => resolve({ timedOut: true }), 5000),
        );
        const result = await Promise.race([query, timeout]);
        if (!active) return;
        if ("timedOut" in result) {
          console.warn("Supabase load timed out; using local data.");
          setRecords(readLocal());
        } else if (result.error) {
          console.error("Failed to load games:", result.error.message);
          setRecords(readLocal());
        } else {
          setRecords((result.data ?? []) as GameRecord[]);
        }
      } else {
        setRecords(readLocal());
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const addGame = useCallback(
    async (outcome: GameOutcome, handId: string | null) => {
      const optimistic: GameRecord = {
        id: tempId(),
        hand_id: handId,
        outcome,
        won_at: new Date().toISOString(),
      };
      setRecords((prev) => {
        const next = [...prev, optimistic];
        if (!isSupabaseConfigured) writeLocal(next);
        return next;
      });

      if (supabase) {
        const { data, error } = await supabase
          .from("mahjong_wins")
          .insert({ hand_id: handId, outcome })
          .select("id, hand_id, won_at, outcome")
          .single();
        if (error) {
          console.error("Failed to log game:", error.message);
          setRecords((prev) => prev.filter((r) => r.id !== optimistic.id));
        } else if (data) {
          setRecords((prev) =>
            prev.map((r) =>
              r.id === optimistic.id ? (data as GameRecord) : r,
            ),
          );
        }
      }
    },
    [],
  );

  const logWin = useCallback((handId: string) => addGame("win", handId), [
    addGame,
  ]);
  const logLoss = useCallback(() => addGame("loss", null), [addGame]);
  const logWall = useCallback(() => addGame("wall", null), [addGame]);

  const removeGame = useCallback(async (record: GameRecord) => {
    setRecords((prev) => {
      const next = prev.filter((r) => r !== record);
      if (!isSupabaseConfigured) writeLocal(next);
      return next;
    });
    if (supabase && record.id && !record.id.startsWith("tmp-")) {
      const { error } = await supabase
        .from("mahjong_wins")
        .delete()
        .eq("id", record.id);
      if (error) console.error("Failed to remove game:", error.message);
    }
  }, []);

  const undoWin = useCallback(
    async (handId: string) => {
      const wins = recordsRef.current.filter(
        (r) => r.hand_id === handId && r.outcome === "win",
      );
      if (wins.length === 0) return;
      const target = wins.reduce((a, b) => (a.won_at >= b.won_at ? a : b));
      await removeGame(target);
    },
    [removeGame],
  );

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const r of records) {
      if (r.outcome === "win" && r.hand_id) {
        tally[r.hand_id] = (tally[r.hand_id] ?? 0) + 1;
      }
    }
    return tally;
  }, [records]);

  const totalWins = records.filter((r) => r.outcome === "win").length;
  const totalLosses = records.filter((r) => r.outcome === "loss").length;
  const totalWalls = records.filter((r) => r.outcome === "wall").length;
  const totalGames = records.length;
  const playedCount = Object.keys(counts).length;

  return {
    records,
    counts,
    loading,
    totalWins,
    totalLosses,
    totalWalls,
    totalGames,
    playedCount,
    logWin,
    logLoss,
    logWall,
    undoWin,
    removeGame,
    backend,
  };
}
