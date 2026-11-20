import type { GameConfig, GameResult, Round } from "../types";
import { makeCtx, money, pairwiseFromPoints } from "../scoring";

/**
 * Wolf. The wolf rotates in player order. After seeing tee shots the wolf picks a partner, goes "lone"
 * or "blind" (lone, declared before anyone tees off; points doubled).
 *  - Partner hole: best ball of each side. Winners get 1 point each.
 *  - Lone wolf wins: wolf gets 3 points. Lone wolf loses: each opponent gets 1 point.
 *  - Blind wolf: same, doubled.
 * Ties = no points. Money = every pair settles (point difference x stake).
 */
export function wolf(round: Round, game: GameConfig): GameResult {
  const c = makeCtx(round, game);
  const picks = round.wolf?.[game.id] ?? [];
  const pts: Record<string, number> = {};
  for (const id of c.ids) pts[id] = 0;
  const rows: (string | number)[][] = [];
  const lines: string[] = [];
  const warnings: string[] = [];
  const n = c.ids.length;
  if (n < 3) warnings.push("Wolf needs at least 3 players (4 is standard).");

  for (let h = 0; h < c.holes; h++) {
    const wolfId = c.ids[h % n];
    const pick = picks[h];
    if (!c.complete(h)) continue;
    if (!pick) {
      rows.push([h + 1, c.name(wolfId), "No pick", 0]);
      continue;
    }
    const best = (ids: string[]) => Math.min(...ids.map((id) => c.score(id, h)!));
    const others = c.ids.filter((id) => id !== wolfId);
    if (pick.choice === "lone" || pick.choice === "blind") {
      const mult = pick.choice === "blind" ? 2 : 1;
      const w = c.score(wolfId, h)!;
      const o = best(others);
      if (w < o) {
        pts[wolfId] += 3 * mult;
        rows.push([h + 1, c.name(wolfId), `${pick.choice} wolf`, `Wolf wins (+${3 * mult})`]);
      } else if (w > o) {
        for (const id of others) pts[id] += 1 * mult;
        rows.push([h + 1, c.name(wolfId), `${pick.choice} wolf`, `Pack wins (+${mult} each)`]);
      } else rows.push([h + 1, c.name(wolfId), `${pick.choice} wolf`, "Tie"]);
    } else {
      const partner = pick.choice;
      const team = [wolfId, partner];
      const rest = c.ids.filter((id) => !team.includes(id));
      if (!c.ids.includes(partner) || rest.length === 0) {
        warnings.push(`Hole ${h + 1}: invalid partner.`);
        continue;
      }
      const a = best(team);
      const b = best(rest);
      if (a < b) {
        for (const id of team) pts[id] += 1;
        rows.push([h + 1, c.name(wolfId), `with ${c.name(partner)}`, "Wolf team wins (+1 each)"]);
      } else if (a > b) {
        for (const id of rest) pts[id] += 1;
        rows.push([h + 1, c.name(wolfId), `with ${c.name(partner)}`, "Other team wins (+1 each)"]);
      } else rows.push([h + 1, c.name(wolfId), `with ${c.name(partner)}`, "Tie"]);
    }
  }
  const net = pairwiseFromPoints(c.ids, pts, game.stake);
  lines.push(...c.ids.map((id) => `${c.name(id)}: ${pts[id]} pts`));
  return {
    gameId: game.id,
    title: game.label || `Wolf (${money(game.stake)}/point)`,
    net,
    lines,
    warnings,
    table: { headers: ["Hole", "Wolf", "Pick", "Result"], rows },
  };
}
