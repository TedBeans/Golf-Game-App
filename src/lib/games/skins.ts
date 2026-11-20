import type { GameConfig, GameResult, Round } from "../types";
import { cents, emptyNet, makeCtx, money } from "../scoring";

export function skins(round: Round, game: GameConfig): GameResult {
  const c = makeCtx(round, game);
  const net = emptyNet(c.ids);
  const lines: string[] = [];
  const rows: (string | number)[][] = [];
  let carry = 0;
  const n = c.ids.length;

  for (let h = 0; h < c.holes; h++) {
    if (!c.complete(h)) break; // carryover depends on order, so stop at the first unfinished hole
    const scores = c.ids.map((id) => ({ id, s: c.score(id, h)! }));
    const low = Math.min(...scores.map((x) => x.s));
    const winners = scores.filter((x) => x.s === low);
    const value = game.stake * (1 + carry);
    if (winners.length === 1) {
      const w = winners[0].id;
      for (const id of c.ids) net[id] += id === w ? value * (n - 1) : -value;
      lines.push(`Hole ${h + 1}: ${c.name(w)} wins ${carry ? `${carry + 1} skins` : "the skin"} (${money(value)} from each player)`);
      rows.push([h + 1, c.name(w), carry + 1, money(value * (n - 1))]);
      carry = 0;
    } else {
      if (game.carryover) {
        carry += 1;
        lines.push(`Hole ${h + 1}: tied, skin carries over (${carry + 1} on the next hole)`);
        rows.push([h + 1, "Carry", carry, "-"]);
      } else {
        lines.push(`Hole ${h + 1}: tied, no skin`);
        rows.push([h + 1, "Tie", 0, "-"]);
      }
    }
  }
  if (carry > 0) lines.push(`${carry} carried skin(s) still open.`);
  for (const id of c.ids) net[id] = cents(net[id]);
  return {
    gameId: game.id,
    title: game.label || `Skins (${money(game.stake)}/skin${game.carryover ? ", carryover" : ""})`,
    net,
    lines,
    table: { headers: ["Hole", "Winner", "Skins", "Won"], rows },
  };
}
