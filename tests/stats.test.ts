import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_HANDS, SECTIONS } from "@/data/hands";
import {
  outcomeTotals,
  recentDecisiveRate,
  cardProgress,
  winMilestone,
  sectionStats,
  totalPoints,
  gamePoints,
  detailStats,
  roundStats,
  roundsForDay,
  openRoundForDay,
  localDayKey,
  gamesByDay,
  dayRecap,
  topHands,
  fmtPct,
  pointsBreakdown,
  tournamentStats,
} from "@/lib/stats";
import { gamesToCsv } from "@/lib/export";
import type { GameRecord, Round } from "@/lib/types";

let n = 0;
const at = (day: string, hh = 19, mm = 0) => new Date(`${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`).toISOString();
function g(outcome: GameRecord["outcome"], over: Partial<GameRecord> = {}): GameRecord {
  n++;
  return {
    id: `g${n}`,
    hand_id: outcome === "win" ? (over.hand_id ?? ALL_HANDS[0].id) : null,
    outcome,
    won_at: over.won_at ?? at("2026-10-01", 12, n % 60),
    round_id: null,
    jokerless: false,
    self_drawn: false,
    blanks: false,
    details_recorded: true,
    card_year: 2026,
    ...over,
  };
}
const legacy = (o: GameRecord["outcome"], over: Partial<GameRecord> = {}) => g(o, { details_recorded: false, ...over });

test("card data is unchanged: 72 hands in 9 sections, unique ids", () => {
  assert.equal(ALL_HANDS.length, 72);
  assert.equal(SECTIONS.length, 9);
  assert.equal(new Set(ALL_HANDS.map((h) => h.id)).size, 72);
});

test("totals, overall and decisive rates match the reference numbers", () => {
  const recs = [
    ...Array.from({ length: 142 }, () => legacy("win")),
    ...Array.from({ length: 324 }, () => legacy("loss")),
    ...Array.from({ length: 74 }, () => legacy("wall")),
  ];
  const o = outcomeTotals(recs);
  assert.equal(o.total, 540);
  assert.equal(o.win + o.loss + o.wall, o.total);
  assert.equal(o.decided, 466);
  assert.equal(fmtPct(o.winRate), "26.3%");
  assert.equal(fmtPct(o.decisiveRate), "30.5%");
  assert.equal(fmtPct(o.wallRate), "13.7%");
});

test("rates are null (not 0% or NaN) with no games", () => {
  const o = outcomeTotals([]);
  assert.equal(o.winRate, null);
  assert.equal(o.decisiveRate, null);
  assert.equal(fmtPct(null), "—");
  const walls = outcomeTotals([g("wall"), g("wall")]);
  assert.equal(walls.decisiveRate, null);
  assert.equal(walls.winRate, 0);
});

test("recent decisive rate skips walls and reports the real sample", () => {
  const recs: GameRecord[] = [];
  for (let i = 0; i < 60; i++) recs.push(g(i < 20 ? "win" : "loss", { won_at: new Date(2026, 9, 1, 0, i).toISOString() }));
  // newest 10 are walls; they must not use up the window
  for (let i = 0; i < 10; i++) recs.push(g("wall", { won_at: new Date(2026, 9, 2, 0, i).toISOString() }));
  const r = recentDecisiveRate(recs, 50);
  assert.equal(r.sample, 50);
  assert.equal(r.wins, 10); // wins were the oldest 20; last 50 decided include 10 of them
  const small = recentDecisiveRate([g("win"), g("loss"), g("wall")], 50);
  assert.equal(small.sample, 2);
  assert.equal(small.rate, 0.5);
});

test("unique hands: first win raises completion, repeat win doesn't, undo lowers it", () => {
  const h1 = ALL_HANDS[0].id, h2 = ALL_HANDS[1].id;
  const a = [g("win", { hand_id: h1 })];
  assert.equal(cardProgress(a).won, 1);
  assert.equal(winMilestone(a, h1).firstForHand, false);
  assert.equal(winMilestone(a, h2).firstForHand, true);
  const b = [...a, g("win", { hand_id: h1 })];
  assert.equal(cardProgress(b).won, 1);
  assert.equal(topHands(b)[0].wins, 2);
  const c = [...b, g("win", { hand_id: h2 })];
  assert.equal(cardProgress(c).won, 2);
  const undone = c.filter((r) => r.hand_id !== h2); // remove the only win on h2
  assert.equal(cardProgress(undone).won, 1);
  assert.equal(cardProgress(c).remaining, 70);
});

test("milestones and section completion only fire when the data supports them", () => {
  assert.equal(winMilestone([], ALL_HANDS[0].id).milestone, 1);
  const sec = SECTIONS[0];
  const allButLast = sec.hands.slice(0, -1).map((h) => g("win", { hand_id: h.id }));
  const m = winMilestone(allButLast, sec.hands[sec.hands.length - 1].id);
  assert.equal(m.sectionComplete, sec.name);
  assert.equal(winMilestone(allButLast, sec.hands[0].id).sectionComplete, null);
  const stats = sectionStats([...allButLast, g("win", { hand_id: sec.hands[0].id })]);
  assert.equal(stats[0].wonHands, sec.hands.length - 1); // completion = distinct hands
  assert.equal(stats[0].wins, sec.hands.length); // wins = every win
});

test("points: base value for untracked wins, flat +20 / +10 bonuses for tracked ones", () => {
  const hand = ALL_HANDS.find((h) => !h.id.startsWith("sp-"))!;
  const sp = ALL_HANDS.find((h) => h.id.startsWith("sp-"))!;
  assert.equal(gamePoints(legacy("win", { hand_id: hand.id })), hand.points);
  assert.equal(gamePoints(g("win", { hand_id: hand.id, jokerless: true })), hand.points + 20);
  assert.equal(gamePoints(g("win", { hand_id: hand.id, self_drawn: true })), hand.points + 10);
  assert.equal(gamePoints(g("win", { hand_id: hand.id, jokerless: true, self_drawn: true })), hand.points + 30);
  assert.equal(gamePoints(g("win", { hand_id: sp.id, jokerless: true })), sp.points); // no joker bonus
  assert.equal(totalPoints([g("loss"), g("wall")]), 0);
});

test("tournament: discarding the winning tile costs 10 points", () => {
  const hand = ALL_HANDS[0];
  const recs = [
    g("win", { hand_id: hand.id, tournament: true }),
    g("loss", { tournament: true, discarded_winner: true }),
    g("loss", { tournament: true, discarded_winner: false }),
    g("loss"), // a regular loss never costs points
  ];
  assert.equal(gamePoints(recs[1]), -10);
  assert.equal(totalPoints(recs), hand.points - 10);
  const b = pointsBreakdown(recs);
  assert.equal(b.handPoints, hand.points);
  assert.equal(b.penalties, 1);
  assert.equal(b.net, hand.points - 10);
  const t = tournamentStats(recs);
  assert.equal(t.totals.total, 3);
  assert.equal(t.points.net, hand.points - 10);
});

test("scramble rounds and tournament games never count as blanks", () => {
  const rounds: Round[] = [{ id: "r", started_at: at("2026-11-03"), blanks: true }];
  const d = detailStats([g("loss", { round_id: "r" }), g("loss", { tournament: true, blanks: true }), g("loss", { blanks: true })], rounds);
  assert.equal(d.trackedGames, 3);
  assert.equal(d.blanksGames, 1); // only the single game
});

test("untracked details are unknown, not false", () => {
  const recs = [legacy("win"), legacy("win"), legacy("loss"), g("win", { self_drawn: true }), g("win")];
  const d = detailStats(recs, []);
  assert.equal(d.untrackedWins, 2);
  assert.equal(d.trackedWins, 2);
  assert.equal(d.selfDrawn, 1);
  assert.equal(d.trackedGames, 2); // only the two tracked games have a known blanks value
});

// ---- rounds -----------------------------------------------------------------

const DAY = "2026-11-03";
const round = (id: string, hh: number, extra: Partial<Round> = {}): Round => ({ id, started_at: at(DAY, hh), blanks: false, ...extra });
const inRound = (rid: string, o: GameRecord["outcome"], mm: number, hh = 19) => g(o, { round_id: rid, won_at: at(DAY, hh, mm) });

test("round fills 1..4 and only completes at 4", () => {
  const rounds = [round("r1", 19)];
  const games: GameRecord[] = [];
  for (let i = 0; i < 3; i++) {
    games.push(inRound("r1", i === 1 ? "loss" : i === 2 ? "wall" : "win", i + 1));
    const v = roundsForDay(DAY, rounds, games).rounds[0];
    assert.equal(v.games.length, i + 1);
    assert.equal(v.status, "open");
    assert.equal(roundStats(games, rounds).completed, 0);
  }
  games.push(inRound("r1", "loss", 4));
  assert.equal(roundsForDay(DAY, rounds, games).rounds[0].status, "complete");
  assert.equal(openRoundForDay(DAY, rounds, games), null); // a 5th game won't join it
  const s = roundStats(games, rounds);
  assert.equal(s.completed, 1);
  assert.equal(s.winsInCompleted, 1);
  assert.equal(s.avgWinsPerCompleted, 1);
  assert.equal(s.completedWithWin, 1);
  assert.equal(s.completedMultiWin, 0);

  // Undo the 4th game: the round goes back to 3 of 4 and is open again.
  const undone = games.slice(0, 3);
  assert.equal(roundsForDay(DAY, rounds, undone).rounds[0].status, "open");
  assert.equal(roundStats(undone, rounds).completed, 0);
});

test("ended-early and superseded rounds are incomplete, not complete", () => {
  const rounds = [round("r1", 18, { closed_at: at(DAY, 18, 30) }), round("r2", 19)];
  const games = [inRound("r1", "win", 1, 18), inRound("r1", "loss", 2, 18), inRound("r2", "win", 1)];
  const day = roundsForDay(DAY, rounds, games);
  assert.equal(day.rounds[0].status, "ended");
  assert.equal(day.rounds[1].status, "open");
  assert.equal(openRoundForDay(DAY, rounds, games)?.round.id, "r2");
  const s = roundStats(games, rounds);
  assert.equal(s.completed, 0);
  assert.equal(s.incomplete, 2);
  assert.equal(s.avgWinsPerCompleted, null);
});

test("zero rounds is valid and historical games are never grouped", () => {
  const recs = Array.from({ length: 9 }, (_, i) => legacy(i % 3 === 0 ? "win" : "loss", { won_at: at(DAY, 10, i) }));
  const s = roundStats(recs, []);
  assert.equal(s.completed, 0);
  assert.equal(s.tracked, 0);
  assert.equal(roundsForDay(DAY, [], recs).unassigned.length, 9);
});

// ---- dates ------------------------------------------------------------------

test("games land on the local calendar day, not the UTC day", () => {
  const late = new Date(2026, 9, 31, 23, 30); // 11:30pm local
  const key = localDayKey(late);
  assert.equal(key, "2026-10-31");
  const map = gamesByDay([g("loss", { won_at: late.toISOString() })]);
  assert.deepEqual([...map.keys()], ["2026-10-31"]);
});

test("day recap counts first-time hands only on their first day", () => {
  const h = ALL_HANDS[3].id;
  const recs = [
    g("win", { hand_id: h, won_at: at("2026-10-01") }),
    g("win", { hand_id: h, won_at: at("2026-10-02") }),
    g("loss", { won_at: at("2026-10-02", 20) }),
  ];
  assert.equal(dayRecap("2026-10-01", recs, []).firstTimeHands.length, 1);
  const d2 = dayRecap("2026-10-02", recs, []);
  assert.equal(d2.firstTimeHands.length, 0);
  assert.equal(d2.totals.total, 2);
  assert.equal(d2.uniqueHands, 1);
});

test("CSV export marks unknown details as not recorded", () => {
  const csv = gamesToCsv([legacy("win"), g("win", { self_drawn: true }), g("loss")], []);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^game_id,date,time/);
  assert.match(lines[1], /not recorded/);
  assert.match(lines[2], /self-drawn/);
  assert.match(lines[1], /,not recorded,/); // mode of an older game
});
