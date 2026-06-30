"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { WinRecord } from "@/lib/types";

const LOCAL_KEY = "mahjong_win_records";
const LEGACY_KEY = "mahjong_wins"; // older counts-only format

// localStorage helpers (used when Supabase env vars are absent).
function readLocal(): WinRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as WinRecord[];
    // Migrate the older { handId: count } format, if present.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const counts = JSON.parse(legacy) as Record<string, number>;
      const now = new Date().toISOString();
      const migrated: WinRecord[] = [];
      for (const [hand_id, count] of Object.entries(counts)) {
        for (let i = 0; i < count; i++) {
          migrated.push({ id: `legacy-${hand_id}-${i}`, hand_id, won_at: now });
        }
      }
      return migrated;
    }
    return [];
  } catch {
    return [];
  }
}

function writeLocal(records: WinRecord[]) {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
}

function tempId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseWins {
  records: WinRecord[];
  counts: Record<string, number>;
  loading: boolean;
  /** Total wins logged across all hands. */
  totalWins: number;
  /** Number of distinct hands won at least once. */
  playedCount: number;
  logWin: (handId: string) => Promise<void>;
  undoWin: (handId: string) => Promise<void>;
  backend: "supabase" | "local";
}

export function useWins(): UseWins {
  const [records, setRecords] = useState<WinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const backend = isSupabaseConfigured ? "supabase" : "local";

  // Mirror of the latest records so callbacks can read current state without
  // going stale or depending on it.
  const recordsRef = useRef<WinRecord[]>([]);
  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  // Initial load.
  useEffect(() => {
    let active = true;
    async function load() {
      if (supabase) {
        // Don't let a slow/unreachable database hang the UI forever — race the
        // query against a timeout and fall back to whatever we have locally.
        const query = supabase
          .from("mahjong_wins")
          .select("id, hand_id, won_at")
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
          console.error(
            "Failed to load wins from Supabase:",
            result.error.message,
          );
          setRecords(readLocal());
        } else {
          setRecords((result.data ?? []) as WinRecord[]);
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

  const logWin = useCallback(async (handId: string) => {
    const optimistic: WinRecord = {
      id: tempId(),
      hand_id: handId,
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
        .insert({ hand_id: handId })
        .select("id, hand_id, won_at")
        .single();
      if (error) {
        console.error("Failed to log win:", error.message);
        // Roll back the optimistic record.
        setRecords((prev) => prev.filter((r) => r.id !== optimistic.id));
      } else if (data) {
        // Replace the temp record with the real one from the server.
        setRecords((prev) =>
          prev.map((r) => (r.id === optimistic.id ? (data as WinRecord) : r)),
        );
      }
    }
  }, []);

  const undoWin = useCallback(async (handId: string) => {
    // Find the most recent record for this hand from current state.
    const forHand = recordsRef.current.filter((r) => r.hand_id === handId);
    if (forHand.length === 0) return;
    const target = forHand.reduce((a, b) => (a.won_at >= b.won_at ? a : b));

    setRecords((prev) => {
      const next = prev.filter((r) => r !== target);
      if (!isSupabaseConfigured) writeLocal(next);
      return next;
    });

    if (supabase && target.id && !target.id.startsWith("tmp-")) {
      const { error } = await supabase
        .from("mahjong_wins")
        .delete()
        .eq("id", target.id);
      if (error) console.error("Failed to undo win:", error.message);
    }
  }, []);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const r of records) tally[r.hand_id] = (tally[r.hand_id] ?? 0) + 1;
    return tally;
  }, [records]);

  const totalWins = records.length;
  const playedCount = Object.keys(counts).length;

  return {
    records,
    counts,
    loading,
    totalWins,
    playedCount,
    logWin,
    undoWin,
    backend,
  };
}
