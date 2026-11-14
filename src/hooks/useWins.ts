"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { GameOutcome, GameRecord, Round } from "@/lib/types";
import { CARD_YEAR } from "@/data/hands";
import {
  GAMES_PER_ROUND,
  localDayKey,
  openRoundForDay,
  roundsForDay,
  type RoundView,
} from "@/lib/stats";

const LOCAL_KEY = "mahjong_game_records";
const ROUNDS_KEY = "mahjong_rounds";
const LEGACY_RECORDS_KEY = "mahjong_win_records"; // wins-only records
const LEGACY_COUNTS_KEY = "mahjong_wins"; // oldest { handId: count } format

const GAME_COLUMNS =
  "id, hand_id, won_at, outcome, round_id, jokerless, self_drawn, blanks, details_recorded, card_year, tournament, discarded_winner";
const ROUND_COLUMNS = "id, started_at, blanks, closed_at";

const WRITE_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// localStorage (used when Supabase env vars are absent)
// ---------------------------------------------------------------------------

function readLocal(): GameRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as GameRecord[];

    // Older on-device formats never asked about jokers / self-drawn / blanks.
    const recs = window.localStorage.getItem(LEGACY_RECORDS_KEY);
    if (recs) {
      const old = JSON.parse(recs) as { id?: string; hand_id: string; won_at: string }[];
      return old.map((r) => ({ ...r, outcome: "win" as GameOutcome, details_recorded: false }));
    }

    const counts = window.localStorage.getItem(LEGACY_COUNTS_KEY);
    if (counts) {
      const map = JSON.parse(counts) as Record<string, number>;
      const now = new Date().toISOString();
      const out: GameRecord[] = [];
      for (const [hand_id, count] of Object.entries(map)) {
        for (let i = 0; i < count; i++) {
          out.push({ id: `legacy-${hand_id}-${i}`, hand_id, outcome: "win", won_at: now, details_recorded: false });
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

// Ids are made on the device, so a retried save can never create a duplicate
// and Undo always knows exactly which row to remove.
export function newId(): string {
  const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TransientError("timed out")), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// A save that may work if tried again (network, timeout, sleeping database).
class TransientError extends Error {}
// A save the database refused for good (e.g. a round that's already full).
class RejectedError extends Error {}

type PgError = { code?: string; message: string } | null;

// Turn a Supabase response into success / retry / rejected.
function check(error: PgError, opts: { duplicateOk?: boolean } = {}) {
  if (!error) return;
  if (opts.duplicateOk && error.code === "23505") return; // already saved
  // Postgres SQLSTATE codes are 5 chars; anything else is the network/API layer.
  if (error.code && /^[0-9A-Z]{5}$/.test(error.code) && !error.code.startsWith("08")) {
    throw new RejectedError(error.message);
  }
  throw new TransientError(error.message);
}

// ---------------------------------------------------------------------------

// "loading" — first fetch in flight · "online" — showing saved data
// "offline" — no database configured (device only) · "error" — couldn't load
export type SyncStatus = "loading" | "online" | "offline" | "error";
// What the save line says.
export type SaveState = "saved" | "saving" | "error";

export interface LogOptions {
  at?: Date; // backdate the game (defaults to now)
  jokerless?: boolean;
  selfDrawn?: boolean;
  single?: boolean; // log as a single game (no round)
  blanks?: boolean; // blanks setting for a single game
  tournament?: boolean; // a tournament game (single game, tournament scoring)
  discardedWinner?: boolean; // tournament loss: she discarded the winning tile
  roundId?: string; // add to this specific round (calendar)
  newRound?: boolean; // always start a fresh round with this game
}

export interface UseWins {
  records: GameRecord[];
  rounds: Round[];
  counts: Record<string, number>;
  loading: boolean;
  status: SyncStatus;
  saveState: SaveState;
  errorMsg: string | null;
  reload: () => void;
  retrySaves: () => void;
  clearError: () => void;
  /** Today's latest round (open, complete or ended), if any. */
  todayRound: RoundView | null;
  /** Today's round that the next game will go into (null = next game starts a new one). */
  currentRound: RoundView | null;
  /** The number the next round today will have. */
  nextRoundNumber: number;
  logWin: (handId: string, opts?: LogOptions) => GameRecord | null;
  logLoss: (opts?: LogOptions) => GameRecord | null;
  logWall: (opts?: LogOptions) => GameRecord | null;
  endRound: (roundId: string) => void;
  removeRound: (roundId: string) => void;
  setGameBlanks: (record: GameRecord, blanks: boolean) => void;
  undoWin: (handId: string) => void;
  removeGame: (record: GameRecord) => void;
}

interface Op {
  run: () => Promise<void>;
  revert: () => void; // undo the local change if the database refuses it
  label: string;
}

export function useWins(): UseWins {
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SyncStatus>(isSupabaseConfigured ? "loading" : "offline");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs are the source of truth for logic (always current, even between
  // renders, so rapid taps see each other); state mirrors them for rendering.
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

  // ---- outbox ----------------------------------------------------------------
  // Every change shows up on screen immediately, then is saved in order.
  // A failed save stays in the outbox and is retried (on Retry, on the next
  // change, or when the app regains focus), so nothing tapped is ever lost.

  const outbox = useRef<Op[]>([]);
  const flushing = useRef<Promise<void> | null>(null);

  const flush = useCallback((): Promise<void> => {
    if (!supabase) {
      outbox.current = [];
      setPending(0);
      return Promise.resolve();
    }
    if (flushing.current) return flushing.current;
    const p = (async () => {
      while (outbox.current.length) {
        const op = outbox.current[0];
        setSaveError(null); // trying again: show "Saving…" rather than the old failure
        try {
          await withTimeout(op.run(), WRITE_TIMEOUT_MS);
          outbox.current.shift();
          setPending(outbox.current.length);
          setSaveError(null);
        } catch (e) {
          if (e instanceof RejectedError) {
            outbox.current.shift();
            setPending(outbox.current.length);
            op.revert();
            setSaveError(`${op.label}: ${e.message}`);
            continue;
          }
          setSaveError((e as Error)?.message || "Couldn't reach the database");
          return;
        }
      }
    })().finally(() => {
      flushing.current = null;
    });
    flushing.current = p;
    return p;
  }, []);

  const enqueue = useCallback(
    (op: Op) => {
      if (!supabase) return;
      outbox.current.push(op);
      setPending(outbox.current.length);
      void flush();
    },
    [flush],
  );

  // ---- load -----------------------------------------------------------------

  const reload = useCallback(async () => {
    if (!supabase) {
      commitRecords(readLocal());
      commitRounds(readLocalRounds());
      setStatus("offline");
      setLoading(false);
      return;
    }
    // Send unsaved changes first so a fresh load can't hide them.
    if (outbox.current.length) {
      await flush();
      if (outbox.current.length) {
        setLoading(false);
        return; // still offline; keep what's on screen
      }
    }
    setStatus((s) => (s === "online" ? "online" : "loading"));

    const fetchBoth = () =>
      withTimeout(
        Promise.all([
          supabase!.from("mahjong_wins").select(GAME_COLUMNS).order("won_at", { ascending: true }),
          supabase!.from("mahjong_rounds").select(ROUND_COLUMNS).order("started_at", { ascending: true }),
        ]),
        WRITE_TIMEOUT_MS,
      );

    let result: Awaited<ReturnType<typeof fetchBoth>> | null = null;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try {
        result = await fetchBoth();
      } catch {
        /* timed out — the database may be waking up; try once more */
      }
    }

    if (!result) {
      setStatus("error");
      setErrorMsg("The journal didn't answer in time. It may be waking up.");
      setLoading(false);
      return;
    }
    const [games, rnds] = result;
    if (games.error || rnds.error) {
      setStatus("error");
      setErrorMsg((games.error ?? rnds.error)!.message);
      setLoading(false);
      return;
    }
    if (outbox.current.length) {
      setLoading(false);
      return; // a change arrived mid-fetch; keep local until it's saved
    }
    commitRecords((games.data ?? []) as GameRecord[]);
    commitRounds((rnds.data ?? []) as Round[]);
    setStatus("online");
    setErrorMsg(null);
    setLoading(false);
  }, [commitRecords, commitRounds, flush]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Re-fetch when the app regains focus (e.g. reopening it later).
  useEffect(() => {
    if (!supabase) return;
    const onFocus = () => {
      if (document.visibilityState !== "hidden") void reload();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [reload]);

  const retrySaves = useCallback(() => {
    void flush().then(() => {
      if (!outbox.current.length) void reload();
    });
  }, [flush, reload]);

  // ---- rounds -----------------------------------------------------------------

  // Scramble rounds are never played with blanks.
  const createRound = (at: Date): Round => {
    const round: Round = { id: newId(), started_at: at.toISOString(), blanks: false, closed_at: null };
    commitRounds([...roundsRef.current, round]);
    enqueue({
      label: "Couldn't start a round",
      run: async () => {
        const { error } = await supabase!
          .from("mahjong_rounds")
          .insert({ id: round.id, started_at: round.started_at, blanks: round.blanks });
        check(error, { duplicateOk: true });
      },
      revert: () => commitRounds(roundsRef.current.filter((r) => r.id !== round.id)),
    });
    return round;
  };

  const patchRound = useCallback(
    (roundId: string, patch: Partial<Round>, label: string) => {
      const before = roundsRef.current.find((r) => r.id === roundId);
      if (!before) return;
      commitRounds(roundsRef.current.map((r) => (r.id === roundId ? { ...r, ...patch } : r)));
      enqueue({
        label,
        run: async () => {
          const { error } = await supabase!.from("mahjong_rounds").update(patch).eq("id", roundId);
          check(error);
        },
        revert: () => commitRounds(roundsRef.current.map((r) => (r.id === roundId ? before : r))),
      });
    },
    [commitRounds, enqueue],
  );

  // Only empty rounds can be removed (so no games are ever orphaned by accident).
  const removeRound = useCallback(
    (roundId: string) => {
      if (recordsRef.current.some((g) => g.round_id === roundId)) return;
      const before = roundsRef.current.find((r) => r.id === roundId);
      if (!before) return;
      commitRounds(roundsRef.current.filter((r) => r.id !== roundId));
      enqueue({
        label: "Couldn't remove the round",
        run: async () => {
          const { error } = await supabase!.from("mahjong_rounds").delete().eq("id", roundId);
          check(error);
        },
        revert: () => commitRounds([...roundsRef.current, before]),
      });
    },
    [commitRounds, enqueue],
  );

  // End a round before its 4th game. It stays as an incomplete round; an
  // empty round is simply removed so no blank rounds pile up.
  const endRound = useCallback(
    (roundId: string) => {
      if (!recordsRef.current.some((g) => g.round_id === roundId)) return removeRound(roundId);
      patchRound(roundId, { closed_at: new Date().toISOString() }, "Couldn't end the round");
    },
    [patchRound, removeRound],
  );

  // ---- games ------------------------------------------------------------------

  // Decide the round synchronously from local state, show the game at once,
  // then save. Returns the new record (its id is final) or null if refused.
  const addGame = useCallback(
    (outcome: GameOutcome, handId: string | null, opts: LogOptions = {}): GameRecord | null => {
      const at = opts.at ?? new Date();
      let round_id: string | null = null;

      if (opts.roundId) {
        const count = recordsRef.current.filter((g) => g.round_id === opts.roundId).length;
        const round = roundsRef.current.find((r) => r.id === opts.roundId);
        if (!round || count >= GAMES_PER_ROUND) {
          setSaveError("That round already has 4 games.");
          return null;
        }
        round_id = round.id;
      } else if (!opts.single && !opts.tournament) {
        const open = opts.newRound
          ? null
          : openRoundForDay(localDayKey(at), roundsRef.current, recordsRef.current);
        round_id = open?.round.id ?? createRound(at).id;
      }

      const record: GameRecord = {
        id: newId(),
        hand_id: handId,
        outcome,
        won_at: at.toISOString(),
        round_id,
        jokerless: outcome === "win" ? !!opts.jokerless : false,
        self_drawn: outcome === "win" ? !!opts.selfDrawn : false,
        blanks: round_id || opts.tournament ? false : !!opts.blanks,
        details_recorded: true,
        card_year: CARD_YEAR,
        tournament: !!opts.tournament,
        discarded_winner: opts.tournament && outcome === "loss" ? !!opts.discardedWinner : null,
      };
      commitRecords([...recordsRef.current, record]);
      enqueue({
        label: "Couldn't save that game",
        run: async () => {
          const { error } = await supabase!.from("mahjong_wins").insert(record);
          check(error, { duplicateOk: true });
        },
        revert: () => commitRecords(recordsRef.current.filter((r) => r.id !== record.id)),
      });
      return record;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commitRecords, enqueue],
  );

  const logWin = useCallback((handId: string, opts?: LogOptions) => addGame("win", handId, opts), [addGame]);
  const logLoss = useCallback((opts?: LogOptions) => addGame("loss", null, opts), [addGame]);
  const logWall = useCallback((opts?: LogOptions) => addGame("wall", null, opts), [addGame]);

  const removeGame = useCallback(
    (record: GameRecord) => {
      const target = recordsRef.current.find((r) => (record.id ? r.id === record.id : r === record));
      if (!target) return;
      commitRecords(recordsRef.current.filter((r) => r !== target));
      if (!target.id || target.id.startsWith("legacy-")) return;
      enqueue({
        label: "Couldn't remove that game",
        run: async () => {
          const { error } = await supabase!.from("mahjong_wins").delete().eq("id", target.id!);
          check(error);
        },
        revert: () => commitRecords([...recordsRef.current, target]),
      });
    },
    [commitRecords, enqueue],
  );

  const setGameBlanks = useCallback(
    (record: GameRecord, blanks: boolean) => {
      const before = recordsRef.current.find((r) => r.id === record.id);
      if (!before || !before.id) return;
      commitRecords(recordsRef.current.map((r) => (r.id === before.id ? { ...r, blanks } : r)));
      enqueue({
        label: "Couldn't update that game",
        run: async () => {
          const { error } = await supabase!.from("mahjong_wins").update({ blanks }).eq("id", before.id!);
          check(error);
        },
        revert: () => commitRecords(recordsRef.current.map((r) => (r.id === before.id ? before : r))),
      });
    },
    [commitRecords, enqueue],
  );

  // Remove the most recent win on a hand.
  const undoWin = useCallback(
    (handId: string) => {
      const winsForHand = recordsRef.current.filter((r) => r.hand_id === handId && r.outcome === "win");
      if (winsForHand.length === 0) return;
      removeGame(winsForHand.reduce((a, b) => (a.won_at >= b.won_at ? a : b)));
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
  const today = useMemo(() => roundsForDay(todayKey, rounds, records), [todayKey, rounds, records]);
  const todayRound = today.rounds[today.rounds.length - 1] ?? null;
  const currentRound = todayRound && todayRound.status === "open" ? todayRound : null;
  const nextRoundNumber = currentRound ? currentRound.number : today.rounds.length + 1;

  const saveState: SaveState = saveError && pending > 0 ? "error" : pending > 0 ? "saving" : "saved";

  return {
    records,
    rounds,
    counts,
    loading,
    status,
    saveState,
    errorMsg: saveError ?? errorMsg,
    reload,
    retrySaves,
    clearError: () => setSaveError(null),
    todayRound,
    currentRound,
    nextRoundNumber,
    logWin,
    logLoss,
    logWall,
    endRound,
    removeRound,
    setGameBlanks,
    undoWin,
    removeGame,
  };
}
