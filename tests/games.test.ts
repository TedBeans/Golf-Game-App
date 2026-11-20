import { describe, expect, it } from "vitest";
import type { GameConfig, Round } from "../src/lib/types";
import { computeGame, computeRound } from "../src/lib/games";
import { settle, strokesOnHole } from "../src/lib/scoring";
import { DEFAULT_PARS, DEFAULT_SI } from "../src/lib/courses";
import { balances } from "../src/lib/ledger";

const P = (id: string, handicap = 0) => ({ id, name: id.toUpperCase(), handicap });

function mk(scores: Record<string, (number | null)[]>, games: GameConfig[], extra: Partial<Round> = {}): Round {
  const ids = Object.keys(scores);
  const holes = (Object.values(scores)[0].length === 9 ? 9 : 18) as 9 | 18;
  return {
    id: "r", createdAt: 0, date: "2026-01-01", holes,
    course: { id: "c", name: "T", pars: DEFAULT_PARS, strokeIndex: DEFAULT_SI },
    playerIds: ids, players: ids.map((i) => P(i)), handicapMode: "none",
    scores, games, wolf: {}, bingo: {}, sideBets: [], status: "active", ...extra,
  };
}
const G = (o: Partial<GameConfig>): GameConfig => ({ id: "g", type: "skins", stake: 1, basis: "gross", playerIds: [], ...o });
const fill = <T,>(n: number, v: T): T[] => Array(n).fill(v);
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe("handicap strokes", () => {
  it("gives strokes on hardest holes", () => {
    expect(strokesOnHole(0, 1)).toBe(0);
    expect(strokesOnHole(5, 3)).toBe(1);
    expect(strokesOnHole(5, 6)).toBe(0);
    expect(strokesOnHole(20, 2)).toBe(2);
    expect(strokesOnHole(20, 3)).toBe(1);
    expect(strokesOnHole(18, 18)).toBe(1);
  });
});

describe("skins", () => {
  it("pays winner from every player and carries ties", () => {
    const a = [4, 4, ...fill(16, 5)], b = [4, 3, ...fill(16, 5)], c = [5, 5, ...fill(16, 5)];
    const r = mk({ a, b, c }, [G({ type: "skins", stake: 2, carryover: true })]);
    const res = computeGame(r, r.games[0]);
    // hole1 tie a/b -> carry. hole2 b wins 2 skins = 4 from each other player => +8
    expect(res.net.b).toBe(8);
    expect(res.net.a).toBe(-4);
    expect(res.net.c).toBe(-4);
    expect(sum(res.net)).toBe(0);
  });
  it("no carryover", () => {
    const r = mk({ a: [4, 4, ...fill(16, 5)], b: [4, 3, ...fill(16, 5)] }, [G({ stake: 2, carryover: false })]);
    expect(computeGame(r, r.games[0]).net).toEqual({ a: -2, b: 2 });
  });
  it("uses net scores", () => {
    const r = mk({ a: fill(18, 5), b: fill(18, 5) }, [G({ basis: "net", stake: 1 })], {
      handicapMode: "full", players: [P("a", 18), P("b", 0)],
    });
    // a gets a stroke every hole => wins every skin
    expect(computeGame(r, r.games[0]).net).toEqual({ a: 18, b: -18 });
  });
});

describe("nassau", () => {
  it("front/back/overall with ties pushing", () => {
    const a = [...fill(9, 4), ...fill(9, 5)];
    const b = [...fill(9, 5), ...fill(9, 4)];
    const r = mk({ a, b }, [G({ type: "nassau", stake: 5 })]);
    const res = computeGame(r, r.games[0]);
    expect(res.net).toEqual({ a: 0, b: 0 }); // each wins one nine, overall tied
    const r2 = mk({ a: fill(18, 4), b: fill(18, 5) }, [G({ type: "nassau", stake: 5 })]);
    expect(computeGame(r2, r2.games[0]).net).toEqual({ a: 15, b: -15 });
  });
  it("pays nothing until a segment is complete", () => {
    const r = mk({ a: [...fill(5, 4), ...fill<number | null>(13, null)], b: [...fill(5, 5), ...fill<number | null>(13, null)] }, [G({ type: "nassau", stake: 5 })]);
    expect(computeGame(r, r.games[0]).net).toEqual({ a: 0, b: 0 });
  });
});

describe("pairwise games", () => {
  it("stroke play per stroke", () => {
    const r = mk({ a: fill(18, 4), b: fill(18, 5), c: fill(18, 6) }, [G({ type: "strokeplay", stake: 1 })]);
    const n = computeGame(r, r.games[0]).net;
    expect(n).toEqual({ a: 54, b: 0, c: -54 }); // a beats b by 18 and c by 36
    expect(sum(n)).toBe(0);
  });
  it("stableford", () => {
    const r = mk({ a: fill(18, 4), b: fill(18, 5) }, [G({ type: "stableford", stake: 1 })]);
    const n = computeGame(r, r.games[0]).net;
    expect(n.a).toBeGreaterThan(0);
    expect(sum(n)).toBe(0);
  });
  it("bingo bango bongo", () => {
    const r = mk({ a: fill(18, 4), b: fill(18, 4) }, [G({ type: "bingo", stake: 1 })]);
    r.bingo = { g: [{ bingo: "a", bango: "a", bongo: "b" }, ...fill(17, null)] };
    expect(computeGame(r, r.games[0]).net).toEqual({ a: 1, b: -1 });
  });
});

describe("wolf", () => {
  it("lone wolf win is zero-sum", () => {
    const r = mk({ a: fill(18, 3), b: fill(18, 4), c: fill(18, 4), d: fill(18, 4) }, [G({ type: "wolf", stake: 1 })]);
    r.wolf = { g: [{ choice: "lone" }, ...fill(17, null)] };
    const n = computeGame(r, r.games[0]).net;
    expect(sum(n)).toBe(0);
    expect(n.a).toBe(9); // 3 pts vs three players at 0 => +3 each pair
  });
  it("team hole", () => {
    const r = mk({ a: fill(18, 3), b: fill(18, 4), c: fill(18, 5), d: fill(18, 5) }, [G({ type: "wolf", stake: 1 })]);
    r.wolf = { g: [{ choice: "b" }, ...fill(17, null)] };
    const n = computeGame(r, r.games[0]).net;
    expect(n.a).toBe(n.b);
    expect(n.a).toBe(2);
    expect(sum(n)).toBe(0);
  });
});

describe("vegas", () => {
  it("combines low-high and swings by the difference", () => {
    const r = mk({ a: fill(18, 4), b: fill(18, 5), c: fill(18, 5), d: fill(18, 6) }, [G({ type: "vegas", stake: 1, teamA: ["a", "b"], teamB: ["c", "d"] })]);
    // A = 45, B = 56 => diff 11 per hole on each of 18 holes => 198 per player
    const n = computeGame(r, r.games[0]).net;
    expect(n.a).toBe(198);
    expect(n.c).toBe(-198);
    expect(sum(n)).toBe(0);
  });
});

describe("rounds, side bets and settlement", () => {
  it("combines games and side bets and stays zero-sum", () => {
    const r = mk({ a: fill(18, 4), b: fill(18, 5), c: fill(18, 6) }, [G({ type: "nassau", stake: 5 })]);
    r.sideBets = [{ id: "s", label: "CTP", amount: 2, winnerId: "c" }];
    const { net } = computeRound(r);
    expect(sum(net)).toBeCloseTo(0, 5);
    expect(net.c).toBe(-15 + 4);
  });
  it("settle uses the fewest payments", () => {
    const t = settle({ a: 30, b: -10, c: -20 });
    expect(t).toHaveLength(2);
    expect(t.reduce((s, x) => s + x.amount, 0)).toBe(30);
  });
  it("payments reduce balances", () => {
    const r = mk({ a: fill(18, 4), b: fill(18, 5) }, [G({ type: "strokeplay", stake: 1 })]); // a +18, b -18
    const state = { version: 1 as const, players: [], rounds: [r], payments: [{ id: "p", date: 0, fromId: "b", toId: "a", amount: 10 }] };
    expect(balances(state)).toEqual({ a: 8, b: -8 });
  });
});
