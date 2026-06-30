import { ALL_HANDS, SECTIONS } from "@/data/hands";
import type { Hand, WinRecord } from "@/lib/types";

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

export interface SectionStat {
  id: string;
  name: string;
  accentClass: string;
  wins: number;
  total: number; // hands in section
  playedHands: number; // distinct hands won at least once
}

// Wins per section, in card order.
export function winsBySection(records: WinRecord[]): SectionStat[] {
  const winCount = new Map<string, number>();
  const playedSet = new Map<string, Set<string>>();
  for (const r of records) {
    const sec = HAND_SECTION.get(r.hand_id);
    if (!sec) continue;
    winCount.set(sec.id, (winCount.get(sec.id) ?? 0) + 1);
    if (!playedSet.has(sec.id)) playedSet.set(sec.id, new Set());
    playedSet.get(sec.id)!.add(r.hand_id);
  }
  return SECTIONS.map((s) => ({
    id: s.id,
    name: s.name,
    accentClass: s.accentClass,
    wins: winCount.get(s.id) ?? 0,
    total: s.hands.length,
    playedHands: playedSet.get(s.id)?.size ?? 0,
  }));
}

export interface HandStat {
  hand: Hand;
  sectionName: string;
  wins: number;
}

// Most-won hands, highest first.
export function topHands(records: WinRecord[], limit = 6): HandStat[] {
  const tally = new Map<string, number>();
  for (const r of records) tally.set(r.hand_id, (tally.get(r.hand_id) ?? 0) + 1);
  const stats: HandStat[] = [];
  for (const [handId, wins] of tally) {
    const hand = HAND_BY_ID.get(handId);
    if (!hand) continue;
    stats.push({
      hand,
      sectionName: HAND_SECTION.get(handId)?.name ?? "",
      wins,
    });
  }
  stats.sort((a, b) => b.wins - a.wins);
  return stats.slice(0, limit);
}

export interface DayBucket {
  key: string; // YYYY-MM-DD
  label: string; // e.g. "6/30"
  weekday: string; // e.g. "Mon"
  count: number;
}

// Wins per day for the last `days` days (oldest -> newest), including zeros.
export function winsByDay(records: WinRecord[], days = 14): DayBucket[] {
  const buckets: DayBucket[] = [];
  const byKey = new Map<string, number>();
  for (const r of records) {
    const key = r.won_at.slice(0, 10);
    byKey.set(key, (byKey.get(key) ?? 0) + 1);
  }
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
      count: byKey.get(key) ?? 0,
    });
  }
  return buckets;
}

export interface RecentWin {
  record: WinRecord;
  hand: Hand;
  sectionName: string;
}

// Most recent wins, newest first.
export function recentWins(records: WinRecord[], limit = 8): RecentWin[] {
  return [...records]
    .sort((a, b) => (a.won_at < b.won_at ? 1 : -1))
    .slice(0, limit)
    .map((record) => ({
      record,
      hand: HAND_BY_ID.get(record.hand_id)!,
      sectionName: HAND_SECTION.get(record.hand_id)?.name ?? "",
    }))
    .filter((r) => r.hand);
}

// Total points scored across all logged wins.
export function totalPoints(records: WinRecord[]): number {
  let sum = 0;
  for (const r of records) sum += HAND_BY_ID.get(r.hand_id)?.points ?? 0;
  return sum;
}

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
