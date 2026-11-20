import type { GameConfig, GameResult, Round } from "../types";
import { makeCtx, money, pairwiseFromPoints } from "../scoring";

/** Pairwise: every player pays/collects (stroke difference x stake) against each other player. */
export function strokeplay(round: Round, game: GameConfig): GameResult {
  const c = makeCtx(round, game);
  const totals: Record<string, number> = {};
  let holesCounted = 0;
  for (const id of c.ids) totals[id] = 0;
  for (let h = 0; h < c.holes; h++) {
    if (!c.complete(h)) continue;
    holesCounted++;
    for (const id of c.ids) totals[id] += c.score(id, h)!;
  }
  // lower score = better, so use negative totals as "points"
  const pts: Record<string, number> = {};
  for (const id of c.ids) pts[id] = -totals[id];
  const net = pairwiseFromPoints(c.ids, pts, game.stake);
  return {
    gameId: game.id,
    title: game.label || `Stroke play (${money(game.stake)}/stroke)`,
    net,
    lines: [
      `${holesCounted} hole(s) counted, ${game.basis} scores.`,
      ...c.ids.map((id) => `${c.name(id)}: ${totals[id]}`),
    ],
    table: { headers: ["Player", "Total"], rows: c.ids.map((id) => [c.name(id), totals[id]]) },
  };
}
