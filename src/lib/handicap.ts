import type { Round } from "./types";

/** WHS course handicap when slope + rating are known, otherwise the index rounded. */
export function courseHandicap(index: number, par: number, slope?: number, rating?: number): number {
  if (slope && rating) return Math.round(index * (slope / 113) + (rating - par));
  return Math.round(index);
}

export function totalPar(pars: number[], holes = 18) {
  return pars.slice(0, holes).reduce((a, b) => a + b, 0);
}

/** Strokes received on a hole (SI 1 = hardest). Handles 18+ and plus handicaps. */
export function strokesOnHole(hcp: number, strokeIndex: number, holes = 18): number {
  const h = Math.round(hcp);
  if (h === 0) return 0;
  if (h > 0) return Math.floor(h / holes) + (strokeIndex <= h % holes ? 1 : 0);
  const give = -h;
  return -(Math.floor(give / holes) + (strokeIndex > holes - (give % holes) ? 1 : 0));
}

/** Stroke index re-ranked 1..n across the holes being played (matters for 9-hole rounds). */
export function rankedSI(round: Round): number[] {
  const n = round.holes;
  const si = round.course.strokeIndex.slice(0, n);
  const order = si.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i);
  const out = new Array(n).fill(0);
  order.forEach((o, rank) => (out[o.i] = rank + 1));
  return out;
}

/** Full course handicap per player (before the low man adjustment). */
export function courseHandicaps(round: Round): Record<string, number> {
  const par = round.course.pars.slice(0, round.holes).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const p of round.players) {
    let ch = p.courseHcp ?? courseHandicap(p.index, round.holes === 9 ? par * 2 : par, round.course.slope, round.course.rating);
    if (p.courseHcp === undefined && round.holes === 9) ch = Math.round(ch / 2);
    out[p.id] = ch;
  }
  return out;
}

/** Off the low man: the lowest handicap plays to zero, everyone else gets the difference. */
export function playingHandicaps(round: Round): Record<string, number> {
  const ch = courseHandicaps(round);
  const ids = round.players.map((p) => p.id);
  const low = ids.length ? Math.min(...ids.map((id) => ch[id])) : 0;
  return Object.fromEntries(ids.map((id) => [id, ch[id] - low]));
}
