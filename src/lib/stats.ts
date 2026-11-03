import { ALL_HANDS, CARD_YEAR, SECTIONS } from "@/data/hands";
import type { GameOutcome, GameRecord, Hand, Round, Tracked } from "@/lib/types";

// ---------------------------------------------------------------------------
// Every number in the app comes from these helpers, so each definition lives
// in exactly one place. Rates return null when the denominator is zero, so
// the UI can show an empty state instead of 0% or NaN.
// ---------------------------------------------------------------------------

// hand id -> hand, and hand id -> its section (id + display name).
const HAND_BY_ID = new Map<string, Hand>(ALL_HANDS.map((h) => [h.id, h]));
const HAND_SECTION = new Map<string, { id: string; name: string }>();
for (const section of SECTIONS) {
  for (const hand of section.hands) {
    HAND_SECTION.set(hand.id, { id: section.id, name: section.name });
  }
}

export function handById(id: string): Hand | undefined {
  return HAND_BY_ID.get(id);
}

export function sectionOf(handId: string): { id: string; name: string } | undefined {
  return HAND_SECTION.get(handId);
}

const byTimeAsc = (a: GameRecord, b: GameRecord) => (a.won_at < b.won_at ? -1 : a.won_at > b.won_at ? 1 : 0);
const byTimeDesc = (a: GameRecord, b: GameRecord) => byTimeAsc(b, a);

const isWin = (r: GameRecord) => r.outcome === "win" && !!r.hand_id;
const wins = (records: GameRecord[]) => records.filter(isWin);

export function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

// "26.3%" or "—". One decimal everywhere for consistency.
export function fmtPct(r: number | null, digits = 1): string {
  return r === null ? "—" : `${(r * 100).toFixed(digits)}%`;
}

export function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Card year
// ---------------------------------------------------------------------------

export function gameCardYear(r: GameRecord): number {
  return r.card_year ?? CARD_YEAR;
}

// Games played with the current card. Card progress only ever uses these.
export function cardYearRecords(records: GameRecord[], year = CARD_YEAR): GameRecord[] {
  return records.filter((r) => gameCardYear(r) === year);
}

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

export interface OutcomeTotals {
  win: number;
  loss: number;
  wall: number;
  total: number; // win + loss + wall
  decided: number; // win + loss
  winRate: number | null; // overall: wins / total games
  decisiveRate: number | null; // wins / (wins + losses)
  wallRate: number | null; // walls / total games
}

export function outcomeTotals(records: GameRecord[]): OutcomeTotals {
  let win = 0,
    loss = 0,
    wall = 0;
  for (const r of records) {
    if (r.outcome === "win") win++;
    else if (r.outcome === "loss") loss++;
    else if (r.outcome === "wall") wall++;
  }
  const total = win + loss + wall;
  const decided = win + loss;
  return {
    win,
    loss,
    wall,
    total,
    decided,
    winRate: ratio(win, total),
    decisiveRate: ratio(win, decided),
    wallRate: ratio(wall, total),
  };
}

export interface RecentRate {
  window: number; // requested size, e.g. 50
  sample: number; // decided games actually used (≤ window)
  wins: number;
  rate: number | null;
}

// Win rate over the most recent `window` decided games (walls skipped).
export function recentDecisiveRate(records: GameRecord[], window = 50): RecentRate {
  const decided = records
    .filter((r) => r.outcome === "win" || r.outcome === "loss")
    .sort(byTimeDesc)
    .slice(0, window);
  const w = decided.filter((r) => r.outcome === "win").length;
  return { window, sample: decided.length, wins: w, rate: ratio(w, decided.length) };
}

// ---------------------------------------------------------------------------
// Unique hands and card progress
// ---------------------------------------------------------------------------

// Distinct valid hands with at least one recorded win.
export function uniqueHandsWon(records: GameRecord[]): Set<string> {
  const set = new Set<string>();
  for (const r of wins(records)) if (HAND_BY_ID.has(r.hand_id!)) set.add(r.hand_id!);
  return set;
}

export const MILESTONES = [1, 25, 50, 60, ALL_HANDS.length];

export interface CardProgress {
  won: number;
  total: number;
  remaining: number;
  pct: number; // 0–1
  nextMilestone: number | null;
  sectionsComplete: string[]; // section names
}

export function cardProgress(records: GameRecord[]): CardProgress {
  const won = uniqueHandsWon(records);
  const total = ALL_HANDS.length;
  const sectionsComplete = SECTIONS.filter((s) => s.hands.every((h) => won.has(h.id))).map(
    (s) => s.name,
  );
  return {
    won: won.size,
    total,
    remaining: total - won.size,
    pct: total ? won.size / total : 0,
    nextMilestone: MILESTONES.find((m) => m > won.size) ?? null,
    sectionsComplete,
  };
}

export interface WinMilestone {
  firstForHand: boolean; // this hand had never been won before
  uniqueAfter: number;
  milestone: number | null; // a MILESTONES value this win reaches
  sectionComplete: string | null; // section finished by this win
  cardComplete: boolean;
}

// What a new win on `handId` would achieve, given the records before it.
export function winMilestone(before: GameRecord[], handId: string): WinMilestone {
  const won = uniqueHandsWon(before);
  const firstForHand = !won.has(handId) && HAND_BY_ID.has(handId);
  if (!firstForHand) {
    return { firstForHand, uniqueAfter: won.size, milestone: null, sectionComplete: null, cardComplete: false };
  }
  won.add(handId);
  const sec = HAND_SECTION.get(handId);
  const section = sec ? SECTIONS.find((s) => s.id === sec.id) : undefined;
  const sectionComplete = section && section.hands.every((h) => won.has(h.id)) ? section.name : null;
  return {
    firstForHand,
    uniqueAfter: won.size,
    milestone: MILESTONES.includes(won.size) ? won.size : null,
    sectionComplete,
    cardComplete: won.size === ALL_HANDS.length,
  };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export interface SectionStat {
  id: string;
  name: string;
  accentClass: string;
  wins: number; // section wins: every win on a hand in this section
  total: number; // hands in the section
  wonHands: number; // section completion: distinct hands won at least once
}

export function sectionStats(records: GameRecord[]): SectionStat[] {
  const winCount = new Map<string, number>();
  const wonSet = new Map<string, Set<string>>();
  for (const r of wins(records)) {
    const sec = HAND_SECTION.get(r.hand_id!);
    if (!sec) continue;
    winCount.set(sec.id, (winCount.get(sec.id) ?? 0) + 1);
    if (!wonSet.has(sec.id)) wonSet.set(sec.id, new Set());
    wonSet.get(sec.id)!.add(r.hand_id!);
  }
  return SECTIONS.map((s) => ({
    id: s.id,
    name: s.name,
    accentClass: s.accentClass,
    wins: winCount.get(s.id) ?? 0,
    total: s.hands.length,
    wonHands: wonSet.get(s.id)?.size ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Hands: most won, recently won
// ---------------------------------------------------------------------------

export interface HandStat {
  hand: Hand;
  sectionName: string;
  wins: number;
  lastWon: string; // ISO time of the latest win
}

function handTallies(records: GameRecord[]): HandStat[] {
  const map = new Map<string, HandStat>();
  for (const r of wins(records)) {
    const hand = HAND_BY_ID.get(r.hand_id!);
    if (!hand) continue;
    const cur = map.get(hand.id);
    if (cur) {
      cur.wins++;
      if (r.won_at > cur.lastWon) cur.lastWon = r.won_at;
    } else {
      map.set(hand.id, {
        hand,
        sectionName: HAND_SECTION.get(hand.id)?.name ?? "",
        wins: 1,
        lastWon: r.won_at,
      });
    }
  }
  return [...map.values()];
}

// Most wins first; ties go to the more recent win.
export function topHands(records: GameRecord[], limit = 6): HandStat[] {
  return handTallies(records)
    .sort((a, b) => b.wins - a.wins || (a.lastWon < b.lastWon ? 1 : -1))
    .slice(0, limit);
}

// Distinct hands ordered by their latest win, newest first.
export function recentlyWonHands(records: GameRecord[], limit = 8): HandStat[] {
  return handTallies(records)
    .sort((a, b) => (a.lastWon < b.lastWon ? 1 : -1))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Dates (always the player's local calendar day)
// ---------------------------------------------------------------------------

// YYYY-MM-DD in the *local* timezone, so an evening game lands on the right day.
export function localDayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

// All games grouped by local day, each day's list oldest-first.
export function gamesByDay(records: GameRecord[]): Map<string, GameRecord[]> {
  const map = new Map<string, GameRecord[]>();
  for (const r of [...records].sort(byTimeAsc)) {
    const key = localDayKey(new Date(r.won_at));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

export interface OutcomeBucket {
  key: string;
  label: string;
  win: number;
  loss: number;
  wall: number;
  total: number;
  decisiveRate: number | null;
}

function bucket(key: string, label: string, games: GameRecord[]): OutcomeBucket {
  const o = outcomeTotals(games);
  return { key, label, win: o.win, loss: o.loss, wall: o.wall, total: o.total, decisiveRate: o.decisiveRate };
}

// The most recent `limit` days she actually played, oldest -> newest.
// These are playing dates, not sessions: older games have no session data.
export function outcomesByPlayingDate(records: GameRecord[], limit = 12): OutcomeBucket[] {
  const days = [...gamesByDay(records).entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return days.slice(-limit).map(([key, games]) => {
    const d = dayKeyToDate(key);
    return bucket(key, `${d.getMonth() + 1}/${d.getDate()}`, games);
  });
}

// Every calendar month from the first game to the latest, oldest -> newest.
export function outcomesByMonth(records: GameRecord[]): OutcomeBucket[] {
  if (records.length === 0) return [];
  const byMonth = new Map<string, GameRecord[]>();
  for (const r of records) {
    const d = new Date(r.won_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(r);
  }
  const keys = [...byMonth.keys()].sort();
  const [fy, fm] = keys[0].split("-").map(Number);
  const [ly, lm] = keys[keys.length - 1].split("-").map(Number);
  const out: OutcomeBucket[] = [];
  for (let y = fy, m = fm; y < ly || (y === ly && m <= lm); m === 12 ? (y++, (m = 1)) : m++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
    out.push(bucket(key, label, byMonth.get(key) ?? []));
  }
  return out;
}

export interface ActivityItem {
  record: GameRecord;
  outcome: GameOutcome;
  hand: Hand | null;
  sectionName: string;
}

// Most recent games of any outcome, newest first.
export function recentActivity(records: GameRecord[], limit = 10): ActivityItem[] {
  return [...records]
    .sort(byTimeDesc)
    .slice(0, limit)
    .map((record) => ({
      record,
      outcome: record.outcome,
      hand: record.hand_id ? (HAND_BY_ID.get(record.hand_id) ?? null) : null,
      sectionName: record.hand_id ? (HAND_SECTION.get(record.hand_id)?.name ?? "") : "",
    }));
}

// ---------------------------------------------------------------------------
// Scoring
//   - A winning hand scores its value from the card.
//   - Won without jokers: +20 (not Singles & Pairs, which never use jokers).
//   - Self-drawn (she drew her own Mahjong tile): +10.
//   - Tournament loss where she discarded the winning tile: -10.
// Older games never recorded jokers / self-drawn, so they count at base value.
// ---------------------------------------------------------------------------

export const JOKERLESS_BONUS = 20;
export const SELF_DRAWN_BONUS = 10;
export const DISCARD_PENALTY = 10;

export function isAlwaysJokerless(handId: string): boolean {
  return HAND_SECTION.get(handId)?.id === "singles-pairs";
}

export function winPoints(
  handId: string,
  opts: { jokerless: boolean; selfDrawn: boolean },
): { base: number; total: number; jokerlessBonus: boolean; selfDrawnBonus: boolean } {
  const base = HAND_BY_ID.get(handId)?.points ?? 0;
  const jokerlessBonus = opts.jokerless && !isAlwaysJokerless(handId);
  const selfDrawnBonus = opts.selfDrawn;
  const total = base + (jokerlessBonus ? JOKERLESS_BONUS : 0) + (selfDrawnBonus ? SELF_DRAWN_BONUS : 0);
  return { base, total, jokerlessBonus, selfDrawnBonus };
}

// Points a single game adds to (or takes from) her total.
export function gamePoints(r: GameRecord): number {
  if (r.outcome === "loss") return r.discarded_winner ? -DISCARD_PENALTY : 0;
  if (!isWin(r)) return 0;
  return winPoints(r.hand_id!, { jokerless: !!r.jokerless, selfDrawn: !!r.self_drawn }).total;
}

// Net points: winning hands minus discard penalties.
export function totalPoints(records: GameRecord[]): number {
  let sum = 0;
  for (const r of records) sum += gamePoints(r);
  return sum;
}

export interface PointsBreakdown {
  net: number;
  handPoints: number; // everything earned from winning hands
  penalties: number; // number of times she discarded the winner
  penaltyPoints: number; // penalties × 10
}

export function pointsBreakdown(records: GameRecord[]): PointsBreakdown {
  let handPoints = 0,
    penalties = 0;
  for (const r of records) {
    if (isWin(r)) handPoints += gamePoints(r);
    else if (r.outcome === "loss" && r.discarded_winner) penalties++;
  }
  const penaltyPoints = penalties * DISCARD_PENALTY;
  return { net: handPoints - penaltyPoints, handPoints, penalties, penaltyPoints };
}

export interface TournamentStats {
  totals: OutcomeTotals;
  points: PointsBreakdown;
}

export function tournamentStats(records: GameRecord[]): TournamentStats {
  const t = records.filter((r) => r.tournament);
  return { totals: outcomeTotals(t), points: pointsBreakdown(t) };
}

// ---------------------------------------------------------------------------
// Optional details: jokers, self-drawn, blanks
// ---------------------------------------------------------------------------

// Were the optional details captured for this game?
export function detailsRecorded(r: GameRecord): boolean {
  return r.details_recorded !== false;
}

// Blanks for a game: scramble rounds and tournament games are never played
// with blanks, single games carry their own setting, and older games that
// were never asked are unknown (null).
export function gameBlanks(g: GameRecord, roundById: Map<string, Round>): Tracked {
  if (g.round_id && roundById.has(g.round_id)) return false;
  if (g.tournament) return false;
  return detailsRecorded(g) ? !!g.blanks : null;
}

export function gameJokerless(g: GameRecord): Tracked {
  if (!isWin(g)) return null;
  if (isAlwaysJokerless(g.hand_id!)) return true;
  return detailsRecorded(g) ? !!g.jokerless : null;
}

export function gameSelfDrawn(g: GameRecord): Tracked {
  if (!isWin(g)) return null;
  return detailsRecorded(g) ? !!g.self_drawn : null;
}

export interface DetailStats {
  trackedWins: number; // wins where self-drawn was asked
  selfDrawn: number;
  jokerEligibleTracked: number; // tracked wins on hands that may use jokers
  noJokers: number;
  untrackedWins: number;
  trackedGames: number; // games whose blanks setting is known
  blanksGames: number;
}

export function detailStats(records: GameRecord[], rounds: Round[]): DetailStats {
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  let trackedWins = 0,
    selfDrawn = 0,
    jokerEligibleTracked = 0,
    noJokers = 0,
    untrackedWins = 0,
    trackedGames = 0,
    blanksGames = 0;
  for (const g of records) {
    const b = gameBlanks(g, roundById);
    if (b !== null) {
      trackedGames++;
      if (b) blanksGames++;
    }
    if (!isWin(g)) continue;
    const sd = gameSelfDrawn(g);
    if (sd === null) {
      untrackedWins++;
      continue;
    }
    trackedWins++;
    if (sd) selfDrawn++;
    if (!isAlwaysJokerless(g.hand_id!)) {
      jokerEligibleTracked++;
      if (g.jokerless) noJokers++;
    }
  }
  return { trackedWins, selfDrawn, jokerEligibleTracked, noJokers, untrackedWins, trackedGames, blanksGames };
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export const GAMES_PER_ROUND = 4;

// complete — exactly 4 games · open — still taking games
// ended — fewer than 4 games and no longer taking any (ended early or superseded)
export type RoundStatus = "complete" | "open" | "ended";

export interface RoundView {
  round: Round;
  number: number; // 1-based within its day
  games: GameRecord[]; // oldest first
  status: RoundStatus;
}

export interface DayRounds {
  rounds: RoundView[];
  unassigned: GameRecord[]; // single games, and games logged before rounds existed
}

function roundGames(records: GameRecord[]): Map<string, GameRecord[]> {
  const map = new Map<string, GameRecord[]>();
  for (const g of records) {
    if (!g.round_id) continue;
    if (!map.has(g.round_id)) map.set(g.round_id, []);
    map.get(g.round_id)!.push(g);
  }
  for (const list of map.values()) list.sort(byTimeAsc);
  return map;
}

function statusOf(round: Round, count: number, isLatestOfDay: boolean): RoundStatus {
  if (count >= GAMES_PER_ROUND) return "complete";
  if (!round.closed_at && isLatestOfDay) return "open";
  return "ended";
}

// Rounds (and round-less games) for one local day.
export function roundsForDay(dayKey: string, rounds: Round[], records: GameRecord[]): DayRounds {
  const dayRounds = rounds
    .filter((r) => localDayKey(new Date(r.started_at)) === dayKey)
    .sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
  const roundIds = new Set(rounds.map((r) => r.id));
  const byRound = roundGames(records);
  const dayGames = records
    .filter((g) => localDayKey(new Date(g.won_at)) === dayKey)
    .sort(byTimeAsc);
  return {
    rounds: dayRounds.map((round, i) => {
      const games = byRound.get(round.id) ?? [];
      return {
        round,
        number: i + 1,
        games,
        status: statusOf(round, games.length, i === dayRounds.length - 1),
      };
    }),
    unassigned: dayGames.filter((g) => !g.round_id || !roundIds.has(g.round_id)),
  };
}

// The round on `dayKey` that can take another game, if any.
export function openRoundForDay(dayKey: string, rounds: Round[], records: GameRecord[]): RoundView | null {
  const day = roundsForDay(dayKey, rounds, records);
  const last = day.rounds[day.rounds.length - 1];
  return last && last.status === "open" ? last : null;
}

export interface RoundStats {
  tracked: number; // rounds with at least one game
  completed: number; // exactly 4 games
  incomplete: number; // 1–3 games
  winsInCompleted: number;
  avgWinsPerCompleted: number | null;
  completedWithWin: number;
  completedMultiWin: number;
}

// Built only from explicitly tracked rounds. Older games never join a round.
export function roundStats(records: GameRecord[], rounds: Round[]): RoundStats {
  const byRound = roundGames(records);
  let tracked = 0,
    completed = 0,
    incomplete = 0,
    winsInCompleted = 0,
    completedWithWin = 0,
    completedMultiWin = 0;
  for (const round of rounds) {
    const games = byRound.get(round.id) ?? [];
    if (games.length === 0) continue;
    tracked++;
    if (games.length !== GAMES_PER_ROUND) {
      incomplete++;
      continue;
    }
    completed++;
    const w = games.filter((g) => g.outcome === "win").length;
    winsInCompleted += w;
    if (w >= 1) completedWithWin++;
    if (w >= 2) completedMultiWin++;
  }
  return {
    tracked,
    completed,
    incomplete,
    winsInCompleted,
    avgWinsPerCompleted: ratio(winsInCompleted, completed),
    completedWithWin,
    completedMultiWin,
  };
}

// ---------------------------------------------------------------------------
// Day recap (a playing date is the "session" unit; older games have no
// session ids, so we never invent boundaries inside a day)
// ---------------------------------------------------------------------------

export interface DayRecap {
  totals: OutcomeTotals;
  points: number;
  uniqueHands: number; // distinct hands won that day
  firstTimeHands: Hand[]; // hands won for the very first time that day
  completedRounds: number;
}

export function dayRecap(
  dayKey: string,
  records: GameRecord[],
  rounds: Round[],
): DayRecap {
  const dayGames = records.filter((g) => localDayKey(new Date(g.won_at)) === dayKey);
  const before = cardYearRecords(records).filter((g) => localDayKey(new Date(g.won_at)) < dayKey);
  const wonBefore = uniqueHandsWon(before);
  const dayWon = uniqueHandsWon(cardYearRecords(dayGames));
  const firstTimeHands = [...dayWon]
    .filter((id) => !wonBefore.has(id))
    .map((id) => HAND_BY_ID.get(id)!)
    .filter(Boolean);
  const day = roundsForDay(dayKey, rounds, records);
  return {
    totals: outcomeTotals(dayGames),
    points: totalPoints(dayGames),
    uniqueHands: dayWon.size,
    firstTimeHands,
    completedRounds: day.rounds.filter((r) => r.status === "complete").length,
  };
}

// ---------------------------------------------------------------------------

// "2h ago", "3d ago", "just now" — compact relative time.
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(iso).toLocaleDateString();
}
