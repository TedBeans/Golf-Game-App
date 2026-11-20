import type { GameConfig, GameResult, Round } from "../types";
import { cents, emptyNet, makeCtx, money } from "../scoring";

/**
 * Vegas: two teams of two. Each hole the two scores are combined low-high into one number (4 and 5 = 45).
 * The difference between the team numbers is the point swing; each player on the winning team collects
 * (difference x stake), each player on the losing team pays it. Birdie flip rule is not applied.
 */
export function vegas(round: Round, game: GameConfig): GameResult {
  const a = (game.teamA ?? []).filter((id) => round.playerIds.includes(id));
  const b = (game.teamB ?? []).filter((id) => round.playerIds.includes(id));
  const ids = [...a, ...b];
  const net = emptyNet(ids);
  const warnings: string[] = [];
  const rows: (string | number)[][] = [];
  if (a.length !== 2 || b.length !== 2) warnings.push("Vegas needs exactly 2 players on each team.");
  const c = makeCtx(round, { basis: game.basis, playerIds: ids });
  if (!warnings.length) {
    const combo = (team: string[], h: number) => {
      const s = team.map((id) => c.score(id, h)!).sort((x, y) => x - y);
      return Math.max(1, s[0]) * 10 + Math.max(1, s[1]);
    };
    for (let h = 0; h < c.holes; h++) {
      if (!c.complete(h)) continue;
      const ca = combo(a, h);
      const cb = combo(b, h);
      const diff = cb - ca; // + = team A wins
      for (const id of a) net[id] += diff * game.stake;
      for (const id of b) net[id] -= diff * game.stake;
      rows.push([h + 1, ca, cb, diff === 0 ? "Push" : `${diff > 0 ? "Team A" : "Team B"} +${Math.abs(diff)}`]);
    }
  }
  for (const id of ids) net[id] = cents(net[id]);
  return {
    gameId: game.id,
    title: game.label || `Vegas (${money(game.stake)}/point)`,
    net,
    lines: [`Team A: ${a.map(c.name).join(" & ")}`, `Team B: ${b.map(c.name).join(" & ")}`],
    warnings,
    table: { headers: ["Hole", "Team A", "Team B", "Swing"], rows },
  };
}
