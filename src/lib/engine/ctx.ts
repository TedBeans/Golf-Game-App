import type { Round } from "../types";
import { playingHandicaps, rankedSI, strokesOnHole } from "../handicap";

export type Ctx = {
  round: Round;
  holes: number;
  name: (id: string) => string;
  par: (h: number) => number;
  gross: (id: string, h: number) => number | null;
  net: (id: string, h: number) => number | null;
  strokes: (id: string, h: number) => number;
  done: (ids: string[], h: number) => boolean;
};

export function makeCtx(round: Round): Ctx {
  const ph = playingHandicaps(round);
  const si = rankedSI(round);
  const strokes = (id: string, h: number) => strokesOnHole(ph[id] ?? 0, si[h], round.holes);
  const gross = (id: string, h: number) => {
    const v = round.scores[id]?.[h];
    return typeof v === "number" && v > 0 ? v : null;
  };
  return {
    round,
    holes: round.holes,
    name: (id) => round.players.find((p) => p.id === id)?.name ?? "?",
    par: (h) => round.course.pars[h] ?? 4,
    gross,
    net: (id, h) => {
      const g = gross(id, h);
      return g === null ? null : g - strokes(id, h);
    },
    strokes,
    done: (ids, h) => ids.every((id) => gross(id, h) !== null),
  };
}

export const zeros = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0])) as Record<string, number>;
export const allIds = (r: Round) => r.players.map((p) => p.id);
export const range = (n: number) => Array.from({ length: n }, (_, i) => i);
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
