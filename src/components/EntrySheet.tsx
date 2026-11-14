"use client";

import { useEffect, useMemo, useState } from "react";
import { SECTIONS } from "@/data/hands";
import type { GameOutcome, Hand } from "@/lib/types";
import {
  DISCARD_PENALTY,
  JOKERLESS_BONUS,
  SELF_DRAWN_BONUS,
  isAlwaysJokerless,
  sectionOf,
  winPoints,
} from "@/lib/stats";
import { OUTCOME_META } from "@/lib/outcomes";
import { HandPattern, handColorText } from "@/components/HandCard";
import { Sheet, SheetHeader } from "@/components/Sheet";

// One entry flow for every game, from every entry point:
//   where it's going (date, mode, round) → outcome → only the questions that
//   apply → the score → an explicit Save. Nothing is saved until Save is tapped,
//   and closing or cancelling never creates a game or a round.

export interface EntryContext {
  dateLabel: string; // full date, e.g. "Saturday, November 14, 2026"
  isToday: boolean;
  modeLabel: string; // "Scramble", "Single game · No blanks", "Tournament"
  roundLabel: string | null; // "Round 2 · Game 3 of 4", or null outside a scramble
  tournament: boolean;
}

export interface EntryRequest {
  outcome: GameOutcome;
  hand?: Hand;
  context: EntryContext;
}

export interface EntryResult {
  outcome: GameOutcome;
  hand?: Hand;
  jokerless: boolean;
  selfDrawn: boolean;
  discardedWinner: boolean;
}

interface EntrySheetProps {
  request: EntryRequest | null; // null = closed
  recent: Hand[];
  favorites: Hand[];
  onSave: (result: EntryResult) => void;
  onClose: () => void;
}

const OUTCOMES: { value: GameOutcome; label: string }[] = [
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "wall", label: "Wall game" },
];

function matches(hand: Hand, sectionName: string, q: string) {
  if (!q) return true;
  return (sectionName + " " + hand.description + " " + hand.pattern.map((p) => p.text).join(" "))
    .toLowerCase()
    .includes(q);
}

// Big either/or choice with a plain-language label on each side.
function Choice<T extends string | boolean>({
  legend,
  value,
  options,
  onChange,
  disabled,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className={disabled ? "opacity-60" : ""}>
      <legend className="text-base font-semibold text-maroon-900">{legend}</legend>
      <div className="mt-1.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label={legend}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-2xl px-2 py-1.5 text-center text-base font-semibold ring-1 transition-colors ${
                active
                  ? "bg-maroon-700 text-cream-50 ring-maroon-700"
                  : "bg-white text-maroon-900 ring-maroon-900/20 hover:bg-cream-100"
              }`}
            >
              <span>
                {active && <span aria-hidden>✓ </span>}
                {o.label}
              </span>
              {o.hint && <span className={`text-sm font-normal ${active ? "text-cream-100" : "text-maroon-900/75"}`}>{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function EntrySheet({ request, recent, favorites, onSave, onClose }: EntrySheetProps) {
  const [outcome, setOutcome] = useState<GameOutcome>("loss");
  const [hand, setHand] = useState<Hand | undefined>();
  const [jokerless, setJokerless] = useState(false);
  const [selfDrawn, setSelfDrawn] = useState(false);
  const [discardedWinner, setDiscardedWinner] = useState(false);
  const [query, setQuery] = useState("");
  // Locks Save after the first tap so a double tap can't log twice.
  const [submitted, setSubmitted] = useState(false);

  // Start fresh each time the sheet opens.
  useEffect(() => {
    if (!request) return;
    setOutcome(request.outcome);
    setHand(request.hand);
    setJokerless(request.hand ? isAlwaysJokerless(request.hand.id) : false);
    setSelfDrawn(false);
    setDiscardedWinner(false);
    setQuery("");
    setSubmitted(false);
  }, [request]);

  function chooseHand(h: Hand) {
    setHand(h);
    setJokerless(isAlwaysJokerless(h.id));
    setSelfDrawn(false);
    setQuery("");
  }

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const out: { id: string; name: string; hands: Hand[] }[] = [];
    if (!q && recent.length) out.push({ id: "recent", name: "Recently won", hands: recent });
    if (!q && favorites.length) out.push({ id: "favorites", name: "Favorites", hands: favorites });
    for (const s of SECTIONS) {
      const hands = s.hands.filter((h) => matches(h, s.name, q));
      if (hands.length) out.push({ id: s.id, name: s.name, hands });
    }
    return out;
  }, [q, recent, favorites]);

  const ctx = request?.context;
  const picking = outcome === "win" && !hand;
  const alwaysJokerless = hand ? isAlwaysJokerless(hand.id) : false;
  const pts = hand ? winPoints(hand.id, { jokerless, selfDrawn }) : null;
  const penalty = outcome === "loss" && ctx?.tournament && discardedWinner;

  const saveLabel =
    outcome === "win"
      ? `Save win · ${pts?.total ?? 0} points`
      : outcome === "loss"
        ? penalty
          ? `Save loss · −${DISCARD_PENALTY} points`
          : "Save loss"
        : "Save wall game";

  function save() {
    if (submitted || picking) return;
    setSubmitted(true);
    onSave({ outcome, hand: outcome === "win" ? hand : undefined, jokerless, selfDrawn, discardedWinner: !!penalty });
  }

  return (
    <Sheet open={!!request} onClose={onClose} labelledBy="entry-title">
      <SheetHeader id="entry-title" title="Log a game" onClose={onClose} />

      {ctx && (
        <>
          {/* Where this game is going */}
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-2xl bg-cream-100 px-4 py-3 text-base ring-1 ring-maroon-900/5">
            <dt className="text-maroon-900/75">Date</dt>
            <dd className="font-semibold text-maroon-900">
              {ctx.dateLabel}
              {ctx.isToday ? (
                <span className="font-normal text-maroon-900/75"> · today</span>
              ) : (
                <span className="ml-2 rounded-full bg-outcome-wall-soft px-2 py-0.5 text-sm font-semibold text-outcome-wall-ink">
                  Earlier date
                </span>
              )}
            </dd>
            <dt className="text-maroon-900/75">Mode</dt>
            <dd className="font-semibold text-maroon-900">{ctx.modeLabel}</dd>
            {ctx.roundLabel && (
              <>
                <dt className="text-maroon-900/75">Round</dt>
                <dd className="font-semibold text-maroon-900">{ctx.roundLabel}</dd>
              </>
            )}
          </dl>

          {/* Outcome */}
          <fieldset className="mt-4">
            <legend className="text-base font-semibold text-maroon-900">How did the game end?</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="How did the game end?">
              {OUTCOMES.map((o) => {
                const active = outcome === o.value;
                const meta = OUTCOME_META[o.value];
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setOutcome(o.value)}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-base font-semibold ring-2 transition-colors ${
                      active ? `${meta.soft} ${meta.ink} ring-maroon-700` : "bg-white text-maroon-900 ring-maroon-900/15 hover:bg-cream-100"
                    }`}
                  >
                    <span aria-hidden>{meta.emoji}</span>
                    <span>
                      {active && <span aria-hidden>✓ </span>}
                      {o.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Win: pick the hand */}
          {picking && (
            <div className="mt-4">
              <label htmlFor="entry-search" className="text-base font-semibold text-maroon-900">
                Which hand did you win with?
              </label>
              <input
                id="entry-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search, e.g. 2468 or NEWS"
                className="mt-1.5 min-h-12 w-full rounded-2xl border-2 border-maroon-900/20 bg-white px-4 text-base text-maroon-900 outline-none placeholder:text-maroon-900/50 focus:border-maroon-600"
              />
              <div className="mt-2 max-h-[38dvh] overflow-y-auto rounded-2xl bg-cream-100 p-2 ring-1 ring-maroon-900/5">
                {groups.map((g) => (
                  <section key={g.id} aria-label={g.name} className="pb-2">
                    <h3 className="px-1 pb-1 pt-1.5 text-sm font-semibold text-maroon-900/80">{g.name}</h3>
                    <ul className="space-y-1.5">
                      {g.hands.map((h) => (
                        <li key={`${g.id}-${h.id}`}>
                          <button
                            type="button"
                            onClick={() => chooseHand(h)}
                            aria-label={`${handColorText(h)}. ${h.description} ${h.points} points, ${h.concealed ? "concealed" : "exposed"}`}
                            className="w-full rounded-xl bg-white px-3 py-2 text-left ring-1 ring-maroon-900/10 hover:ring-maroon-600"
                          >
                            <HandPattern hand={h} decorative className="text-lg font-extrabold" />
                            <span className="mt-0.5 block text-sm text-maroon-900/80">
                              {sectionOf(h.id)?.name} · {h.description} {h.points} pts · {h.concealed ? "Concealed" : "Exposed"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {groups.length === 0 && (
                  <div className="p-4 text-center text-base text-maroon-900/80">
                    No hands match “{query}”.
                    <button type="button" onClick={() => setQuery("")} className="ml-2 font-semibold text-maroon-700 underline">
                      Clear search
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Win: the chosen hand, the two questions, and the score */}
          {outcome === "win" && hand && pts && (
            <>
              <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-maroon-900/15">
                <div className="flex items-start justify-between gap-3">
                  <HandPattern hand={hand} className="text-xl font-extrabold" />
                  <button
                    type="button"
                    onClick={() => setHand(undefined)}
                    className="min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold text-maroon-700 ring-1 ring-maroon-300 hover:bg-maroon-50"
                  >
                    Change hand
                  </button>
                </div>
                <p className="mt-1 text-sm text-maroon-900/80">
                  {sectionOf(hand.id)?.name} · {hand.description}
                </p>
                <p className="text-sm text-maroon-900/80">
                  Card value {hand.points} points · {hand.concealed ? "Concealed" : "Exposed"}
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <Choice
                  legend="Did you use any jokers?"
                  value={jokerless}
                  disabled={alwaysJokerless}
                  onChange={setJokerless}
                  options={[
                    { value: false, label: "Yes, jokers" },
                    { value: true, label: "No jokers", hint: alwaysJokerless ? "no bonus" : `+${JOKERLESS_BONUS} points` },
                  ]}
                />
                {alwaysJokerless && (
                  <p className="-mt-1 text-sm text-maroon-900/80">
                    Singles &amp; Pairs hands never use jokers, so there&apos;s no bonus.
                  </p>
                )}
                <Choice
                  legend="How did you get your last tile?"
                  value={selfDrawn}
                  onChange={setSelfDrawn}
                  options={[
                    { value: false, label: "Someone discarded it" },
                    { value: true, label: "I drew it myself", hint: `+${SELF_DRAWN_BONUS} points` },
                  ]}
                />
              </div>

              <div className="mt-4 rounded-2xl bg-maroon-50 px-4 py-3 ring-1 ring-maroon-200" aria-live="polite">
                <div className="flex items-center justify-between text-base text-maroon-900">
                  <span>Card value</span>
                  <span className="tabular-nums">{pts.base}</span>
                </div>
                {pts.jokerlessBonus && (
                  <div className="flex items-center justify-between text-base text-maroon-900">
                    <span>No jokers</span>
                    <span className="tabular-nums">+{JOKERLESS_BONUS}</span>
                  </div>
                )}
                {pts.selfDrawnBonus && (
                  <div className="flex items-center justify-between text-base text-maroon-900">
                    <span>Self-drawn</span>
                    <span className="tabular-nums">+{SELF_DRAWN_BONUS}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between border-t border-maroon-200 pt-1 font-display text-xl font-bold text-maroon-800">
                  <span>Total</span>
                  <span className="tabular-nums">{pts.total} points</span>
                </div>
              </div>
            </>
          )}

          {/* Loss */}
          {outcome === "loss" && (
            <div className="mt-4">
              {ctx.tournament ? (
                <>
                  <Choice
                    legend="Who discarded the winning tile?"
                    value={discardedWinner}
                    onChange={setDiscardedWinner}
                    options={[
                      { value: false, label: "Someone else", hint: "no penalty" },
                      { value: true, label: "I did", hint: `−${DISCARD_PENALTY} points` },
                    ]}
                  />
                  <p className="mt-2 text-base text-maroon-900/85" aria-live="polite">
                    {discardedWinner
                      ? `This loss takes ${DISCARD_PENALTY} points off your total.`
                      : "This loss doesn't change your points."}
                  </p>
                </>
              ) : (
                <p className="text-base text-maroon-900/85">Someone else won. A loss doesn&apos;t change your points.</p>
              )}
            </div>
          )}

          {/* Wall */}
          {outcome === "wall" && (
            <p className="mt-4 text-base text-maroon-900/85">
              The wall ran out and nobody won. A wall game doesn&apos;t change your points.
            </p>
          )}

          {/* Always in reach: the actions stay pinned to the bottom of the sheet */}
          <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 flex gap-2 border-t border-maroon-900/10 bg-cream-50 px-5 pb-5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 flex-1 rounded-full bg-cream-200 text-base font-semibold text-maroon-800 hover:bg-cream-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitted || picking}
              onClick={save}
              className="min-h-12 flex-[2] rounded-full bg-maroon-700 px-3 text-base font-semibold text-cream-50 shadow hover:bg-maroon-800 disabled:opacity-60"
            >
              {picking ? "Pick a hand to save" : saveLabel}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
