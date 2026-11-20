import type { GameConfig, GameResult, GameType, Round } from "../types";
import { cents, emptyNet, money, settle } from "../scoring";
import { skins } from "./skins";
import { nassau } from "./nassau";
import { strokeplay } from "./strokeplay";
import { stableford } from "./stableford";
import { wolf } from "./wolf";
import { bingo } from "./bingo";
import { vegas } from "./vegas";

export const GAME_INFO: Record<GameType, { name: string; blurb: string; stakeLabel: string; defaultStake: number; supportsBasis: boolean }> = {
  skins: { name: "Skins", blurb: "Lowest unique score on a hole wins a skin from everyone. Optional carryover on ties.", stakeLabel: "$ per skin (from each player)", defaultStake: 2, supportsBasis: true },
  nassau: { name: "Nassau", blurb: "Three bets: front 9, back 9 and overall. Lowest total wins; ties push.", stakeLabel: "$ per bet", defaultStake: 5, supportsBasis: true },
  strokeplay: { name: "Stroke play", blurb: "Pay or collect the stroke difference against every other player.", stakeLabel: "$ per stroke", defaultStake: 1, supportsBasis: true },
  stableford: { name: "Stableford", blurb: "Points per hole vs par. Pay or collect the point difference.", stakeLabel: "$ per point", defaultStake: 1, supportsBasis: true },
  wolf: { name: "Wolf", blurb: "Rotating wolf picks a partner or goes lone. Points settle pairwise.", stakeLabel: "$ per point", defaultStake: 1, supportsBasis: true },
  bingo: { name: "Bingo Bango Bongo", blurb: "Points for first on, closest on, first in. Points settle pairwise.", stakeLabel: "$ per point", defaultStake: 1, supportsBasis: false },
  vegas: { name: "Vegas", blurb: "Two teams of two. Scores combine into a 2-digit number per hole.", stakeLabel: "$ per point (per player)", defaultStake: 0.25, supportsBasis: true },
};

export function computeGame(round: Round, game: GameConfig): GameResult {
  switch (game.type) {
    case "skins": return skins(round, game);
    case "nassau": return nassau(round, game);
    case "strokeplay": return strokeplay(round, game);
    case "stableford": return stableford(round, game);
    case "wolf": return wolf(round, game);
    case "bingo": return bingo(round, game);
    case "vegas": return vegas(round, game);
  }
}

/** Side bets: winner collects `amount` from every other player in the round. */
export function computeSideBets(round: Round): GameResult | null {
  const bets = round.sideBets.filter((b) => b.winnerId && b.amount > 0);
  if (!round.sideBets.length) return null;
  const net = emptyNet(round.playerIds);
  const lines: string[] = [];
  for (const b of bets) {
    const w = b.winnerId!;
    const others = round.playerIds.filter((id) => id !== w);
    for (const id of others) net[id] -= b.amount;
    net[w] += b.amount * others.length;
    const name = round.players.find((p) => p.id === w)?.name ?? "?";
    lines.push(`${b.label}${b.hole ? ` (hole ${b.hole})` : ""}: ${name} wins ${money(b.amount)} from each player`);
  }
  for (const id of round.playerIds) net[id] = cents(net[id]);
  return { gameId: "sidebets", title: "Side bets", net, lines: lines.length ? lines : ["No winners recorded yet."] };
}

export function computeRound(round: Round) {
  const results: GameResult[] = round.games.map((g) => computeGame(round, g));
  const side = computeSideBets(round);
  if (side) results.push(side);
  const net = emptyNet(round.playerIds);
  for (const r of results) for (const [id, v] of Object.entries(r.net)) net[id] = cents((net[id] ?? 0) + v);
  return { results, net, transfers: settle(net) };
}
