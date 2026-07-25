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

    const recs = window.localStorage.getItem(LEGACY_RECORDS_KEY);
    if (recs) {
      const old = JSON.parse(recs) as {
        id?: string;
        hand_id: string;
        won_at: string;
      }[];
      return old.map((r) => ({ ...r, outcome: "win" as GameOutcome }));
    }

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

// "loading"  — first fetch in flight
// "online"   — a fetch succeeded; we're showing live database data
// "offline"  — no database configured; using this device's local storage
// "error"    — database is configured but unreachable/erroring (data NOT lost)
export type SyncStatus = "loading" | "online" | "offline" | "error";

export interface UseWins {
  records: GameRecord[];
  counts: Record<string, number>;
  loading: boolean;
  status: SyncStatus;
  errorMsg: string | null;
  reload: () => void;
  totalWins: number;
  totalLosses: number;
  totalWalls: number;
  totalGames: number;
  playedCount: number;
  logWin: (handId: string, at?: Date) => Promise<void>;
  logLoss: (at?: Date) => Promise<void>;
  logWall: (at?: Date) => Promise<void>;
  undoWin: (handId: string) => Promise<void>;
  removeGame: (record: GameRecord) => Promise<void>;
}

// Race a Supabase query against a timeout so a cold-started/slow project can't
// hang the UI. Returns rows, an error, or a timeout marker.
async function fetchWithTimeout(ms: number) {
  const query = supabase!
    .from("mahjong_wins")
    .select("id, hand_id, won_at, outcome")
    .order("won_at", { ascending: true });
  const timeout = new Promise<{ timedOut: true }>((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), ms),
  );
  return Promise.race([query, timeout]);
}

export function useWins(): UseWins {
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SyncStatus>(
    isSupabaseConfigured ? "loading" : "offline",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recordsRef = useRef<GameRecord[]>([]);
  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  // Load (or reload) from the database. Retries once for cold starts, and on
  // failure keeps any data already on screen and surfaces an honest error —
  // it never blanks the screen in a way that looks like data loss.
  const reload = useCallback(async () => {
    if (!supabase) {
      setRecords(readLocal());
      setStatus("offline");
      setLoading(false);
      return;
    }
    setStatus((s) => (s === "online" ? "online" : "loading"));
    setErrorMsg(null);

    let result = await fetchWithTimeout(8000);
    if ("timedOut" in result) result = await fetchWithTimeout(8000); // cold start retry

    if ("timedOut" in result) {
      setStatus("error");
      setErrorMsg(
        "The database didn't respond in time (it may be waking up). Your data is safe — tap Retry.",
      );
      setLoading(false);
      return;
    }
    if (result.error) {
      setStatus("error");
      setErrorMsg(result.error.message);
      setLoading(false);
      return;
    }
    setRecords((result.data ?? []) as GameRecord[]);
    setStatus("online");
    setErrorMsg(null);
    setLoading(false);
  }, []);

  // Initial load.
  useEffect(() => {
    reload();
  }, [reload]);

  // Re-fetch when the tab regains focus / becomes visible — so reopening the
  // app after it was closed picks the data back up instead of showing stale
  // (or empty) state.
  useEffect(() => {
    if (!supabase) return;
    const onFocus = () => {
      if (document.visibilityState !== "hidden") reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [reload]);

  const addGame = useCallback(
    async (outcome: GameOutcome, handId: string | null, at?: Date) => {
      const won_at = (at ?? new Date()).toISOString();
      const optimistic: GameRecord = {
        id: tempId(),
        hand_id: handId,
        outcome,
        won_at,
      };
      setRecords((prev) => {
        const next = [...prev, optimistic];
        if (!isSupabaseConfigured) writeLocal(next);
        return next;
      });

      if (supabase) {
        const { data, error } = await supabase
          .from("mahjong_wins")
          .insert({ hand_id: handId, outcome, won_at })
          .select("id, hand_id, won_at, outcome")
          .single();
        if (error) {
          console.error("Failed to log game:", error.message);
          setRecords((prev) => prev.filter((r) => r.id !== optimistic.id));
          setStatus("error");
          setErrorMsg(`Couldn't save that game: ${error.message}`);
        } else if (data) {
          setRecords((prev) =>
            prev.map((r) => (r.id === optimistic.id ? (data as GameRecord) : r)),
          );
          setStatus("online");
          setErrorMsg(null);
        }
      }
    },
    [],
  );

  const logWin = useCallback(
    (handId: string, at?: Date) => addGame("win", handId, at),
    [addGame],
  );
  const logLoss = useCallback((at?: Date) => addGame("loss", null, at), [
    addGame,
  ]);
  const logWall = useCallback((at?: Date) => addGame("wall", null, at), [
    addGame,
  ]);

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
      const winsForHand = recordsRef.current.filter(
        (r) => r.hand_id === handId && r.outcome === "win",
      );
      if (winsForHand.length === 0) return;
      const target = winsForHand.reduce((a, b) =>
        a.won_at >= b.won_at ? a : b,
      );
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
    status,
    errorMsg,
    reload,
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
  };
}
