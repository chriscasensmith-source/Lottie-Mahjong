"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const LOCAL_KEY = "mahjong_wins";

type Counts = Record<string, number>;

// localStorage fallback helpers (used when Supabase env vars are absent).
function readLocal(): Counts {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Counts) : {};
  } catch {
    return {};
  }
}

function writeLocal(counts: Counts) {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(counts));
}

export interface UseWins {
  counts: Counts;
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
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);
  const backend = isSupabaseConfigured ? "supabase" : "local";

  // Initial load.
  useEffect(() => {
    let active = true;
    async function load() {
      if (supabase) {
        const { data, error } = await supabase
          .from("mahjong_wins")
          .select("hand_id");
        if (!active) return;
        if (error) {
          console.error("Failed to load wins from Supabase:", error.message);
          setCounts(readLocal());
        } else {
          const tally: Counts = {};
          for (const row of data ?? []) {
            tally[row.hand_id] = (tally[row.hand_id] ?? 0) + 1;
          }
          setCounts(tally);
        }
      } else {
        setCounts(readLocal());
      }
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const logWin = useCallback(async (handId: string) => {
    // Optimistic update.
    setCounts((prev) => {
      const next = { ...prev, [handId]: (prev[handId] ?? 0) + 1 };
      if (!isSupabaseConfigured) writeLocal(next);
      return next;
    });

    if (supabase) {
      const { error } = await supabase
        .from("mahjong_wins")
        .insert({ hand_id: handId });
      if (error) {
        console.error("Failed to log win:", error.message);
        // Roll back on failure.
        setCounts((prev) => ({
          ...prev,
          [handId]: Math.max(0, (prev[handId] ?? 1) - 1),
        }));
      }
    }
  }, []);

  const undoWin = useCallback(async (handId: string) => {
    setCounts((prev) => {
      const current = prev[handId] ?? 0;
      if (current <= 0) return prev;
      const next = { ...prev, [handId]: current - 1 };
      if (!isSupabaseConfigured) writeLocal(next);
      return next;
    });

    if (supabase) {
      // Delete the most recent win for this hand.
      const { data } = await supabase
        .from("mahjong_wins")
        .select("id")
        .eq("hand_id", handId)
        .order("won_at", { ascending: false })
        .limit(1);
      const latest = data?.[0]?.id;
      if (latest) {
        await supabase.from("mahjong_wins").delete().eq("id", latest);
      }
    }
  }, []);

  const totalWins = Object.values(counts).reduce((a, b) => a + b, 0);
  const playedCount = Object.values(counts).filter((c) => c > 0).length;

  return { counts, loading, totalWins, playedCount, logWin, undoWin, backend };
}
