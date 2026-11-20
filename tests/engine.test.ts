import { describe, expect, it } from "vitest";
import type { Game, MatchGame, Round } from "../src/lib/types";
import { CATALOG, SCORING, fixedSegments } from "../src/lib/catalog";
import { computeGame, computeRound } from "../src/lib/engine";
import { courseHandicap, courseHandicaps, playingHandicaps, strokesOnHole } from "../src/lib/handicap";
import { settle } from "../src/lib/money";
import { balances } from "../src/lib/ledger";
import { demoRound } from "../src/lib/demo";
import { DEFAULT_PARS, DEFAULT_SI } from "../src/lib/courses";

const fill = <T,>(n: number, v: T): T[] => Array(n).fill(v);
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

/** ch = course handicap (strokes) per player id */
function mk(ch: Record<string, number>, scores: Record<string, (number | null)[]>, games: Game[] = []): Round {
  const ids = Object.keys(ch);
  return {
    id: "r", createdAt: 0, date: "2026-01-01", holes: 18, status: "active",
    course: { id: "c", name: "T", pars: DEFAULT_PARS, strokeIndex: DEFAULT_SI },
    players: ids.map((id) => ({ id, name: id.toUpperCase(), index: 0, courseHcp: ch[id] })),
    scores: Object.fromEntries(ids.map((id) => [id, [...(scores[id] ?? []), ...fill(18 - (scores[id]?.length ?? 0), null)]])),
    games, wolf: {}, bingo: {}, sideBets: [],
  };
}
const catalog = (key: string, r: Round) => CATALOG.find((c) => c.key === key)!.create(r);
const FOUR = { a: 0, b: 0, c: 0, d: 0 };

describe("handicap: off the low man only", () => {
  it("lowest plays to zero, others get the difference", () => {
    const r = mk({ a: 5, b: 12, c: 9, d: 16 }, {});
    expect(playingHandicaps(r)).toEqual({ a: 0, b: 7, c: 4, d: 11 });
  });
  it("strokes land on the hardest holes", () => {
    expect(strokesOnHole(7, 1)).toBe(1);
    expect(strokesOnHole(7, 7)).toBe(1);
    expect(strokesOnHole(7, 8)).toBe(0);
    expect(strokesOnHole(20, 2)).toBe(2);
    expect(strokesOnHole(20, 3)).toBe(1);
  });
  it("course handicap uses slope and rating when known", () => {
    expect(courseHandicap(10, 72)).toBe(10);
    expect(courseHandicap(10, 72, 130, 73)).toBe(Math.round(10 * (130 / 113) + 1));
  });
});

describe("Sixes + two-point game", () => {
  const six = (r: Round) => catalog("sixes", r) as MatchGame;
  it("rotates partners every six holes", () => {
    const g = six(mk(FOUR, {}));
    expect(g.segments.map((s) => [s.from, s.to])).toEqual([[0, 6], [6, 12], [12, 18]]);
    expect(g.elements).toHaveLength(2); // combined + best ball
  });
  it("awards one point for combined and one for best ball, then pays per point", () => {
    // seg 1: a&b v c&d. a=4,b=5 ; c=4,d=6 -> combined 9 v 10 (A wins), best ball 4 v 4 (tie)
    const r = mk(FOUR, { a: fill(6, 4), b: fill(6, 5), c: fill(6, 4), d: fill(6, 6) });
    const g = six(r); g.stake = 2; r.games = [g];
    const res = computeGame(r, g);
    expect(res.net).toEqual({ a: 2, b: 2, c: -2, d: -2 }); // 1 pt margin x $2
  });
  it("both points to one side doubles the margin", () => {
    const r = mk(FOUR, { a: fill(6, 3), b: fill(6, 5), c: fill(6, 4), d: fill(6, 6) });
    const g = six(r); g.stake = 2; r.games = [g];
    expect(computeGame(r, g).net).toEqual({ a: 4, b: 4, c: -4, d: -4 });
  });
  it("split points cancel to a push", () => {
    // A wins combined, B wins best ball
    const r = mk(FOUR, { a: fill(6, 5), b: fill(6, 5), c: fill(6, 4), d: fill(6, 7) }); // A comb 10 v 11; BB 5 v 4
    const g = six(r); g.stake = 5; r.games = [g];
    expect(computeGame(r, g).net).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });
  it("uses the second pairing on holes 7-12", () => {
    const r = mk(FOUR, { a: fill(12, 4), b: fill(12, 6), c: fill(12, 4), d: fill(12, 6) });
    const g = six(r); g.stake = 1; r.games = [g];
    const res = computeGame(r, g);
    // seg1 a&b v c&d: tie both ways. seg2 a&c v b&d: a&c win both points -> +2 each
    expect(res.net).toEqual({ a: 2, c: 2, b: -2, d: -2 });
  });
  it("handicaps are included (net scores)", () => {
    // b gets a stroke on every hole (ch 18). Without it, A loses combined; with it A wins.
    const r = mk({ a: 0, b: 18, c: 0, d: 0 }, { a: fill(6, 4), b: fill(6, 6), c: fill(6, 4), d: fill(6, 5) });
    const g = six(r); g.stake = 1; g.elements = [SCORING[2].elements()[0]]; r.games = [g];
    // net: a4 b5 = 9 ; c4 d5 = 9 -> push. Gross would be 10 v 9 (A loses)
    expect(computeGame(r, g).net).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });
  it("does not pay until the segment is finished", () => {
    const r = mk(FOUR, { a: fill(4, 3), b: fill(4, 3), c: fill(4, 5), d: fill(4, 5) });
    const g = six(r); r.games = [g];
    const res = computeGame(r, g);
    expect(sum(res.net)).toBe(0);
    expect(res.net.a).toBe(0);
    expect(res.status).toMatch(/thru 4/);
  });
  it("ties can split the point", () => {
    const r = mk(FOUR, { a: fill(6, 4), b: fill(6, 4), c: fill(6, 4), d: fill(6, 4) });
    const g = six(r); g.stake = 4; g.ties = "split"; r.games = [g];
    expect(computeGame(r, g).net).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });
});

describe("match scoring elements", () => {
  it("match play counts holes won", () => {
    const r = mk({ a: 0, b: 0 }, { a: [4, 4, 4, 5, 5, 5, 4, 4, 4], b: [5, 5, 5, 4, 4, 4, 4, 4, 5] });
    const g = catalog("nassau", r) as MatchGame;
    g.teamA = ["a"]; g.teamB = ["b"]; g.stake = 5;
    g.segments = fixedSegments(18, { front: true });
    r.games = [g];
    // holes 1-3 a, 4-6 b, 7-8 halved, 9 a -> a wins 4 holes to 3
    const res = computeGame(r, g);
    expect(res.net).toEqual({ a: 5, b: -5 });
  });
  it("combined vs best ball are different measures", () => {
    const r = mk(FOUR, { a: fill(9, 3), b: fill(9, 9), c: fill(9, 5), d: fill(9, 5) });
    const base = catalog("team", r) as MatchGame;
    base.segments = fixedSegments(18, { front: true }); base.stake = 1; base.teamA = ["a", "b"]; base.teamB = ["c", "d"];
    base.elements = [SCORING[0].elements()[0]]; // best ball: 27 v 45 -> A
    expect(computeGame(r, base).net.a).toBe(1);
    base.elements = [SCORING[2].elements()[0]]; // combined: 108 v 90 -> B
    expect(computeGame(r, base).net.a).toBe(-1);
  });
  it("flags unequal teams", () => {
    const r = mk(FOUR, {});
    const g = catalog("team", r) as MatchGame; g.teamB = ["c"];
    expect(computeGame(r, g).warnings?.length).toBeGreaterThan(0);
  });
});

describe("other games", () => {
  it("skins carry and pay from every player, on net scores", () => {
    const r = mk({ a: 0, b: 0, c: 0 }, { a: [4, 4], b: [4, 3], c: [5, 5] });
    const g = catalog("skins", r) as Extract<Game, { type: "skins" }>; g.stake = 2; r.games = [g];
    const res = computeGame(r, g);
    expect(res.net).toEqual({ a: -4, b: 8, c: -4 });
  });
  it("stroke play pot goes to low net, ties split", () => {
    const r = mk({ a: 0, b: 0 }, { a: fill(18, 4), b: fill(18, 5) });
    const g = catalog("stroke", r) as Extract<Game, { type: "stroke" }>; g.stake = 20; r.games = [g];
    expect(computeGame(r, g).net).toEqual({ a: 20, b: -20 });
  });
  it("wolf lone win is zero-sum", () => {
    const r = mk(FOUR, { a: [3], b: [4], c: [4], d: [4] });
    const g = catalog("wolf", r) as Extract<Game, { type: "wolf" }>; g.stake = 1; r.games = [g];
    r.wolf = { [g.id]: [{ choice: "lone" }] };
    const n = computeGame(r, g).net;
    expect(n.a).toBe(9);
    expect(sum(n)).toBe(0);
  });
  it("vegas swings by the difference", () => {
    const r = mk(FOUR, { a: [4], b: [5], c: [5], d: [6] });
    const g = catalog("vegas", r) as Extract<Game, { type: "vegas" }>; g.stake = 1; r.games = [g];
    const n = computeGame(r, g).net; // 45 v 56
    expect(n.a).toBe(11); expect(n.c).toBe(-11);
  });
});

describe("rounds and ledger", () => {
  it("side bets and games roll into a zero-sum round total", () => {
    const r = mk({ a: 0, b: 0, c: 0 }, { a: fill(18, 4), b: fill(18, 5), c: fill(18, 6) });
    r.games = [catalog("stroke", r)];
    r.sideBets = [{ id: "s", label: "Closest", amount: 2, winnerId: "c" }];
    const { net } = computeRound(r);
    expect(sum(net)).toBeCloseTo(0, 5);
    expect(net.c).toBe(-20 + 4);
  });
  it("settle uses the fewest payments", () => {
    const t = settle({ a: 30, b: -10, c: -20 });
    expect(t).toHaveLength(2);
    expect(t.reduce((s, x) => s + x.amount, 0)).toBe(30);
  });
  it("payments reduce balances and demo rounds never count", () => {
    const r = mk({ a: 0, b: 0 }, { a: fill(18, 4), b: fill(18, 5) });
    r.games = [catalog("stroke", r)];
    const state = { version: 2 as const, players: [], rounds: [r, { ...demoRound() }], payments: [{ id: "p", date: 0, fromId: "b", toId: "a", amount: 5 }] };
    expect(balances(state)).toEqual({ a: 15, b: -15 });
  });
  it("the demo round computes without warnings", () => {
    const d = demoRound();
    const { results, net } = computeRound(d);
    expect(results.every((x) => !x.warnings?.length)).toBe(true);
    expect(sum(net)).toBeCloseTo(0, 5);
  });
});

import { findCatalog } from "../src/lib/tees";
describe("tee catalog", () => {
  it("finds Missouri Bluffs and uses tee par for course handicap", () => {
    const c = findCatalog("The Missouri Bluffs Golf Club")!;
    expect(c.tees.map((t) => t.name)).toContain("Blue");
    const blue = c.tees.find((t) => t.name === "Blue" && t.gender === "M")!;
    const r = demoRound();
    r.holes = 18;
    r.course = { ...r.course, slope: blue.slope, rating: blue.rating, teePar: blue.par };
    // 10.0 * 135/113 + (70.5 - 71) = 11.4 -> 11
    r.players = [{ id: "a", name: "A", index: 10 }, { id: "b", name: "B", index: 0 }];
    expect(courseHandicaps(r).a).toBe(11);
  });
  it("returns null for unknown courses", () => expect(findCatalog("Nowhere Links")).toBeNull());
});
