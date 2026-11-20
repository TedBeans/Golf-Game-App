import type { GameConfig, GameResult, Round } from "../types";
import { makeCtx, money, pairwiseFromPoints } from "../scoring";

/** Bingo Bango Bongo: 1 point each for first on the green, closest once all are on, first in the hole. */
export function bingo(round: Round, game: GameConfig): GameResult {
  const c = makeCtx(round, game);
  const data = round.bingo?.[game.id] ?? [];
  const pts: Record<string, number> = {};
  for (const id of c.ids) pts[id] = 0;
  for (let h = 0; h < c.holes; h++) {
    const d = data[h];
    if (!d) continue;
    for (const k of ["bingo", "bango", "bongo"] as const) {
      const id = d[k];
      if (id && pts[id] !== undefined) pts[id] += 1;
    }
  }
  const net = pairwiseFromPoints(c.ids, pts, game.stake);
  return {
    gameId: game.id,
    title: game.label || `Bingo Bango Bongo (${money(game.stake)}/point)`,
    net,
    lines: c.ids.map((id) => `${c.name(id)}: ${pts[id]} pts`),
    table: { headers: ["Player", "Points"], rows: c.ids.map((id) => [c.name(id), pts[id]]) },
  };
}
