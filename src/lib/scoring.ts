import type { GameConfig, Round, Transfer } from "./types";

export const cents = (n: number) => Math.round(n * 100) / 100;

export const money = (n: number) => {
  const v = cents(n);
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? "-" : ""}$${s}`;
};

export const signedMoney = (n: number) => (cents(n) > 0 ? `+${money(n)}` : money(n));

/** Strokes a player receives on a hole, given handicap and the hole's stroke index (1 = hardest). */
export function strokesOnHole(handicap: number, strokeIndex: number, holesInRound = 18): number {
  const h = Math.round(handicap);
  if (h === 0) return 0;
  if (h > 0) {
    const base = Math.floor(h / holesInRound);
    const extra = h % holesInRound;
    return base + (strokeIndex <= extra ? 1 : 0);
  }
  // plus handicap: gives strokes back on the easiest holes
  const give = -h;
  const base = Math.floor(give / holesInRound);
  const extra = give % holesInRound;
  return -(base + (strokeIndex > holesInRound - extra ? 1 : 0));
}

/** Stroke index re-ranked 1..n among the holes actually being played. */
export function roundStrokeIndex(round: Round): number[] {
  const n = round.holes;
  const si = round.course.strokeIndex.slice(0, n);
  const order = si.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i);
  const ranked = new Array(n).fill(0);
  order.forEach((o, rank) => (ranked[o.i] = rank + 1));
  return ranked;
}

/** Handicap each player actually plays off in this round. */
export function playingHandicaps(round: Round, playerIds: string[] = round.playerIds): Record<string, number> {
  const out: Record<string, number> = {};
  const raw: Record<string, number> = {};
  for (const id of round.playerIds) {
    const p = round.players.find((x) => x.id === id);
    const h = p?.handicap ?? 0;
    raw[id] = round.holes === 9 ? Math.round(h / 2) : h;
  }
  const pool = playerIds.length ? playerIds : round.playerIds;
  const low = Math.min(...pool.map((id) => raw[id] ?? 0));
  for (const id of round.playerIds) {
    if (round.handicapMode === "none") out[id] = 0;
    else if (round.handicapMode === "offLow") out[id] = (raw[id] ?? 0) - low;
    else out[id] = raw[id] ?? 0;
  }
  return out;
}

export type Ctx = {
  holes: number;
  ids: string[];
  name: (id: string) => string;
  par: (h: number) => number;
  gross: (id: string, h: number) => number | null;
  /** Score used by the game: net or gross depending on game.basis */
  score: (id: string, h: number) => number | null;
  strokes: (id: string, h: number) => number;
  /** true when every participant has a score on hole h */
  complete: (h: number) => boolean;
};

export function makeCtx(round: Round, game?: Pick<GameConfig, "basis" | "playerIds">): Ctx {
  const ids = game && game.playerIds.length ? game.playerIds.filter((id) => round.playerIds.includes(id)) : round.playerIds;
  const hcps = playingHandicaps(round, ids);
  const si = roundStrokeIndex(round);
  const strokes = (id: string, h: number) => strokesOnHole(hcps[id] ?? 0, si[h], round.holes);
  const gross = (id: string, h: number) => {
    const v = round.scores[id]?.[h];
    return typeof v === "number" && v > 0 ? v : null;
  };
  const score = (id: string, h: number) => {
    const g = gross(id, h);
    if (g === null) return null;
    return game?.basis === "gross" ? g : g - strokes(id, h);
  };
  return {
    holes: round.holes,
    ids,
    name: (id) => round.players.find((p) => p.id === id)?.name ?? "?",
    par: (h) => round.course.pars[h] ?? 4,
    gross,
    score,
    strokes,
    complete: (h) => ids.every((id) => gross(id, h) !== null),
  };
}

export function emptyNet(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]));
}

/** Pairwise settlement: every pair pays (points difference) x stake. Higher points win. */
export function pairwiseFromPoints(ids: string[], points: Record<string, number>, stake: number): Record<string, number> {
  const net = emptyNet(ids);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const d = (points[ids[i]] - points[ids[j]]) * stake;
      net[ids[i]] += d;
      net[ids[j]] -= d;
    }
  }
  for (const id of ids) net[id] = cents(net[id]);
  return net;
}

/** Collapse many balances into the fewest payments. balances: +ve = is owed, -ve = owes. */
export function settle(balances: Record<string, number>): Transfer[] {
  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];
  for (const [id, b] of Object.entries(balances)) {
    const v = cents(b);
    if (v > 0.004) creditors.push({ id, amt: v });
    else if (v < -0.004) debtors.push({ id, amt: -v });
  }
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const pay = cents(Math.min(creditors[i].amt, debtors[j].amt));
    if (pay > 0) out.push({ from: debtors[j].id, to: creditors[i].id, amount: pay });
    creditors[i].amt = cents(creditors[i].amt - pay);
    debtors[j].amt = cents(debtors[j].amt - pay);
    if (creditors[i].amt <= 0.004) i++;
    if (debtors[j].amt <= 0.004) j++;
  }
  return out;
}

export const stablefordPoints = (score: number, par: number) => Math.max(0, 2 - (score - par));
