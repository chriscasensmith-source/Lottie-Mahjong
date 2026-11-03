"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { GameOutcome, GameRecord, Round } from "@/lib/types";
import {
  GAMES_PER_ROUND,
  localDayKey,
  roundsForDay,
  type RoundView,
} from "@/lib/stats";

const LOCAL_KEY = "mahjong_game_records";
const ROUNDS_KEY = "mahjong_rounds";
const LEGACY_RECORDS_KEY = "mahjong_win_records"; // wins-only records
const LEGACY_COUNTS_KEY = "mahjong_wins"; // oldest { handId: count } format

const GAME_COLUMNS = "id, hand_id, won_at, outcome, round_id, jokerless, self_drawn";
const ROUND_COLUMNS = "id, started_at, blanks";

// ---------------------------------------------------------------------------
// localStorage (used when Supabase env vars are absent)
// ---------------------------------------------------------------------------

function readLocal(): GameRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as GameRecord[];

    const recs = window.localStorage.getItem(LEGACY_RECORDS_KEY);
    if (recs) {
      const old = JSON.parse(recs) as { id?: string; hand_id: string; won_at: string }[];
      return old.map((r) => ({ ...r, outcome: "win" as GameOutcome }));
    }

    const counts = window.localStorage.getItem(LEGACY_COUNTS_KEY);
    if (counts) {
      const map = JSON.parse(counts) as Record<string, number>;
      const now = new Date().toISOString();
      const out: GameRecord[] = [];
      for (const [hand_id, count] of Object.entries(map)) {
        for (let i = 0; i < count; i++) {
          out.push({ id: `legacy-${hand_id}-${i}`, hand_id, outcome: "win", won_at: now });
        }
      }
      return out;
    }
    return [];
  } catch {
    return [];
  }
}

function readLocalRounds(): Round[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ROUNDS_KEY);
    return raw ? (JSON.parse(raw) as Round[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / blocked — ignore */
  }
}

function tempId(prefix = "tmp") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Race a promise against a timeout so a cold-started database can't hang the UI.
function withTimeout<T>(p: PromiseLike<T>, ms: number) {
  const timeout = new Promise<{ timedOut: true }>((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), ms),
  );
  return Promise.race([p, timeout]);
}

// ---------------------------------------------------------------------------

// "loading" — first fetch in flight · "online" — showing live database data
// "offline" — no database configured · "error" — database unreachable (data NOT lost)
export type SyncStatus = "loading" | "online" | "offline" | "error";

export interface LogOptions {
  at?: Date; // backdate the game (defaults to now)
  jokerless?: boolean;
  selfDrawn?: boolean;
  newRoundBlanks?: boolean; // blanks setting if this game has to start a new round
}

export interface UseWins {
  records: GameRecord[];
  rounds: Round[];
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
  /** Today's round that the next game will go into (null = next game starts a new one). */
  currentRound: RoundView | null;
  /** The number the next round today will have. */
  nextRoundNumber: number;
  /** Blanks setting a new round will start with. */
  defaultBlanks: boolean;
  logWin: (handId: string, opts?: LogOptions) => Promise<void>;
  logLoss: (opts?: LogOptions) => Promise<void>;
  logWall: (opts?: LogOptions) => Promise<void>;
  startRound: (opts?: { at?: Date; blanks?: boolean }) => Promise<void>;
  setRoundBlanks: (roundId: string, blanks: boolean) => Promise<void>;
  removeRound: (roundId: string) => Promise<void>;
  undoWin: (handId: string) => Promise<void>;
  removeGame: (record: GameRecord) => Promise<void>;
}

export function useWins(): UseWins {
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SyncStatus>(
    isSupabaseConfigured ? "loading" : "offline",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs are the source of truth for logic (always current, even mid-sequence);
  // state mirrors them for rendering.
  const recordsRef = useRef<GameRecord[]>([]);
  const roundsRef = useRef<Round[]>([]);

  const commitRecords = useCallback((next: GameRecord[]) => {
    recordsRef.current = next;
    setRecords(next);
    if (!isSupabaseConfigured) writeLocal(LOCAL_KEY, next);
  }, []);

  const commitRounds = useCallback((next: Round[]) => {
    roundsRef.current = next;
    setRounds(next);
    if (!isSupabaseConfigured) writeLocal(ROUNDS_KEY, next);
  }, []);

  const fail = useCallback((msg: string) => {
    setStatus("error");
    setErrorMsg(msg);
  }, []);

  // Serialize writes so rapid taps can't both land in a "3 of 4" round.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(task, task);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  // ---- load -----------------------------------------------------------------

  const reload = useCallback(async () => {
    if (!supabase) {
      commitRecords(readLocal());
      commitRounds(readLocalRounds());
      setStatus("offline");
      setLoading(false);
      return;
    }
    setStatus((s) => (s === "online" ? "online" : "loading"));
    setErrorMsg(null);

    const fetchBoth = () =>
      withTimeout(
        Promise.all([
          supabase!.from("mahjong_wins").select(GAME_COLUMNS).order("won_at", { ascending: true }),
          supabase!.from("mahjong_rounds").select(ROUND_COLUMNS).order("started_at", { ascending: true }),
        ]),
        8000,
      );

    let result = await fetchBoth();
    if ("timedOut" in result) result = await fetchBoth(); // cold-start retry

    if ("timedOut" in result) {
      fail("The database didn't respond in time (it may be waking up). Your data is safe — tap Retry.");
      setLoading(false);
      return;
    }
    const [games, rnds] = result;
    if (games.error || rnds.error) {
      fail((games.error ?? rnds.error)!.message);
      setLoading(false);
      return;
    }
    // Keep any optimistic games whose save is still in flight.
    const pending = recordsRef.current.filter((r) => r.id?.startsWith("tmp-"));
    commitRecords([...((games.data ?? []) as GameRecord[]), ...pending]);
    commitRounds((rnds.data ?? []) as Round[]);
    setStatus("online");
    setErrorMsg(null);
    setLoading(false);
  }, [commitRecords, commitRounds, fail]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Re-fetch when the app regains focus (e.g. reopening it later).
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

  // ---- rounds -----------------------------------------------------------------

  const lastBlanks = () => {
    const latest = [...roundsRef.current].sort((a, b) =>
      a.started_at < b.started_at ? 1 : -1,
    )[0];
    return latest?.blanks ?? false;
  };

  // The round on `dayKey` that still has room, if any.
  const openRoundForDay = (dayKey: string): Round | null => {
    const day = roundsRef.current
      .filter((r) => localDayKey(new Date(r.started_at)) === dayKey)
      .sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
    const latest = day[day.length - 1];
    if (!latest) return null;
    const count = recordsRef.current.filter((g) => g.round_id === latest.id).length;
    return count < GAMES_PER_ROUND ? latest : null;
  };

  const createRound = async (at: Date, blanks: boolean): Promise<string> => {
    const started_at = at.toISOString();
    if (!supabase) {
      const round: Round = { id: tempId("round"), started_at, blanks };
      commitRounds([...roundsRef.current, round]);
      return round.id;
    }
    const { data, error } = await supabase
      .from("mahjong_rounds")
      .insert({ started_at, blanks })
      .select(ROUND_COLUMNS)
      .single();
    if (error || !data) {
      fail(`Couldn't start a round: ${error?.message ?? "unknown error"}`);
      throw error ?? new Error("round insert failed");
    }
    commitRounds([...roundsRef.current, data as Round]);
    return (data as Round).id;
  };

  const startRound = useCallback(
    (opts?: { at?: Date; blanks?: boolean }) =>
      enqueue(async () => {
        await createRound(opts?.at ?? new Date(), opts?.blanks ?? lastBlanks());
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enqueue],
  );

  const setRoundBlanks = useCallback(
    async (roundId: string, blanks: boolean) => {
      commitRounds(roundsRef.current.map((r) => (r.id === roundId ? { ...r, blanks } : r)));
      if (supabase) {
        const { error } = await supabase.from("mahjong_rounds").update({ blanks }).eq("id", roundId);
        if (error) fail(`Couldn't update the round: ${error.message}`);
      }
    },
    [commitRounds, fail],
  );

  // Only empty rounds can be removed (so no games are ever orphaned by accident).
  const removeRound = useCallback(
    async (roundId: string) => {
      if (recordsRef.current.some((g) => g.round_id === roundId)) return;
      commitRounds(roundsRef.current.filter((r) => r.id !== roundId));
      if (supabase) {
        const { error } = await supabase.from("mahjong_rounds").delete().eq("id", roundId);
        if (error) fail(`Couldn't remove the round: ${error.message}`);
      }
    },
    [commitRounds, fail],
  );

  // ---- games ------------------------------------------------------------------

  const addGame = useCallback(
    (outcome: GameOutcome, handId: string | null, opts: LogOptions = {}) =>
      enqueue(async () => {
        const at = opts.at ?? new Date();
        const won_at = at.toISOString();

        let round_id: string;
        try {
          round_id =
            openRoundForDay(localDayKey(at))?.id ??
            (await createRound(at, opts.newRoundBlanks ?? lastBlanks()));
        } catch {
          return; // createRound already surfaced the error
        }

        const row = {
          hand_id: handId,
          outcome,
          won_at,
          round_id,
          jokerless: outcome === "win" ? !!opts.jokerless : false,
          self_drawn: outcome === "win" ? !!opts.selfDrawn : false,
        };
        const optimistic: GameRecord = { id: tempId(), ...row };
        commitRecords([...recordsRef.current, optimistic]);

        if (supabase) {
          const { data, error } = await supabase
            .from("mahjong_wins")
            .insert(row)
            .select(GAME_COLUMNS)
            .single();
          if (error) {
            commitRecords(recordsRef.current.filter((r) => r.id !== optimistic.id));
            fail(`Couldn't save that game: ${error.message}`);
          } else if (data) {
            commitRecords(
              recordsRef.current.map((r) => (r.id === optimistic.id ? (data as GameRecord) : r)),
            );
            setStatus("online");
            setErrorMsg(null);
          }
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enqueue, commitRecords, fail],
  );

  const logWin = useCallback(
    (handId: string, opts?: LogOptions) => addGame("win", handId, opts),
    [addGame],
  );
  const logLoss = useCallback((opts?: LogOptions) => addGame("loss", null, opts), [addGame]);
  const logWall = useCallback((opts?: LogOptions) => addGame("wall", null, opts), [addGame]);

  const removeGame = useCallback(
    async (record: GameRecord) => {
      commitRecords(
        recordsRef.current.filter((r) => (record.id ? r.id !== record.id : r !== record)),
      );
      if (supabase && record.id && !record.id.startsWith("tmp-")) {
        const { error } = await supabase.from("mahjong_wins").delete().eq("id", record.id);
        if (error) fail(`Couldn't remove that game: ${error.message}`);
      }
    },
    [commitRecords, fail],
  );

  const undoWin = useCallback(
    async (handId: string) => {
      const winsForHand = recordsRef.current.filter(
        (r) => r.hand_id === handId && r.outcome === "win",
      );
      if (winsForHand.length === 0) return;
      const target = winsForHand.reduce((a, b) => (a.won_at >= b.won_at ? a : b));
      await removeGame(target);
    },
    [removeGame],
  );

  // ---- derived ------------------------------------------------------------------

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const r of records) {
      if (r.outcome === "win" && r.hand_id) tally[r.hand_id] = (tally[r.hand_id] ?? 0) + 1;
    }
    return tally;
  }, [records]);

  const todayKey = localDayKey(new Date());
  const today = useMemo(
    () => roundsForDay(todayKey, rounds, records),
    [todayKey, rounds, records],
  );
  const lastToday = today.rounds[today.rounds.length - 1];
  const currentRound =
    lastToday && lastToday.games.length < GAMES_PER_ROUND ? lastToday : null;
  const nextRoundNumber = currentRound ? currentRound.number : today.rounds.length + 1;
  const defaultBlanks = useMemo(() => {
    const latest = [...rounds].sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
    return latest?.blanks ?? false;
  }, [rounds]);

  return {
    records,
    rounds,
    counts,
    loading,
    status,
    errorMsg,
    reload,
    totalWins: records.filter((r) => r.outcome === "win").length,
    totalLosses: records.filter((r) => r.outcome === "loss").length,
    totalWalls: records.filter((r) => r.outcome === "wall").length,
    totalGames: records.length,
    playedCount: Object.keys(counts).length,
    currentRound,
    nextRoundNumber,
    defaultBlanks,
    logWin,
    logLoss,
    logWall,
    startRound,
    setRoundBlanks,
    removeRound,
    undoWin,
    removeGame,
  };
}
