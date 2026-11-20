import type { Game, GameResult, Round } from "../types";
import { cents, settle } from "../money";
import { allIds, zeros } from "./ctx";
import { match } from "./match";
import { bingo, skins, stableford, stroke, vegas, wolf } from "./games";

export function computeGame(round: Round, g: Game): GameResult {
  switch (g.type) {
    case "match": return match(round, g);
    case "skins": return skins(round, g);
    case "stroke": return stroke(round, g);
    case "stableford": return stableford(round, g);
    case "wolf": return wolf(round, g);
    case "vegas": return vegas(round, g);
    case "bingo": return bingo(round, g);
  }
}

export function computeSideBets(round: Round): GameResult | null {
  if (!round.sideBets.length) return null;
  const ids = allIds(round);
  const net = zeros(ids);
  const lines: string[] = [];
  for (const b of round.sideBets) {
    if (!b.winnerId || !(b.amount > 0)) continue;
    const others = ids.filter((id) => id !== b.winnerId);
    for (const id of others) net[id] -= b.amount;
    net[b.winnerId] += b.amount * others.length;
    lines.push(`${b.label}${b.hole ? ` (#${b.hole})` : ""}: ${round.players.find((p) => p.id === b.winnerId)?.name}`);
  }
  for (const id of ids) net[id] = cents(net[id]);
  return { gameId: "side", title: "Side bets", net, status: lines.length ? `${lines.length} decided` : "None decided yet", lines };
}

export function computeRound(round: Round) {
  const results = round.games.map((g) => computeGame(round, g));
  const side = computeSideBets(round);
  if (side) results.push(side);
  const net = zeros(allIds(round));
  for (const r of results) for (const [id, v] of Object.entries(r.net)) net[id] = cents((net[id] ?? 0) + v);
  return { results, net, transfers: settle(net) };
}
