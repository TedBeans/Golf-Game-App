import type { GameConfig, GameResult, Round } from "../types";
import { makeCtx, money, pairwiseFromPoints, stablefordPoints } from "../scoring";

export function stableford(round: Round, game: GameConfig): GameResult {
  const c = makeCtx(round, game);
  const pts: Record<string, number> = {};
  for (const id of c.ids) pts[id] = 0;
  let holesCounted = 0;
  for (let h = 0; h < c.holes; h++) {
    if (!c.complete(h)) continue;
    holesCounted++;
    for (const id of c.ids) pts[id] += stablefordPoints(c.score(id, h)!, c.par(h));
  }
  const net = pairwiseFromPoints(c.ids, pts, game.stake);
  return {
    gameId: game.id,
    title: game.label || `Stableford (${money(game.stake)}/point)`,
    net,
    lines: [`${holesCounted} hole(s) counted. Double bogey or worse = 0, bogey 1, par 2, birdie 3, eagle 4.`],
    table: { headers: ["Player", "Points"], rows: c.ids.map((id) => [c.name(id), pts[id]]) },
  };
}
