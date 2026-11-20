import type { GameConfig, GameResult, Round } from "../types";
import { cents, emptyNet, makeCtx, money } from "../scoring";

export function nassau(round: Round, game: GameConfig): GameResult {
  const c = makeCtx(round, game);
  const net = emptyNet(c.ids);
  const lines: string[] = [];
  const rows: (string | number)[][] = [];
  const n = c.ids.length;
  const front = game.nassauFront !== false;
  const back = game.nassauBack !== false && round.holes === 18;
  const overall = game.nassauOverall !== false && round.holes === 18;

  const segs: { label: string; from: number; to: number }[] = [];
  if (front) segs.push({ label: "Front 9", from: 0, to: 9 });
  if (back) segs.push({ label: "Back 9", from: 9, to: 18 });
  if (overall) segs.push({ label: "Overall", from: 0, to: 18 });

  for (const seg of segs) {
    const holes = Array.from({ length: seg.to - seg.from }, (_, i) => seg.from + i);
    const done = holes.every((h) => c.complete(h));
    const totals = c.ids.map((id) => ({
      id,
      t: holes.reduce((sum, h) => sum + (c.score(id, h) ?? 0), 0),
      played: holes.filter((h) => c.score(id, h) !== null).length,
    }));
    const played = Math.min(...totals.map((x) => x.played));
    const sorted = [...totals].sort((a, b) => a.t - b.t);
    const leaders = sorted.filter((x) => x.t === sorted[0].t);
    const standing = totals.map((x) => `${c.name(x.id)} ${x.t}`).join(", ");
    if (!done) {
      rows.push([seg.label, `${played}/${holes.length} holes`, standing, "In progress"]);
      lines.push(`${seg.label}: in progress (${standing})`);
      continue;
    }
    if (leaders.length === 1) {
      const w = leaders[0].id;
      for (const id of c.ids) net[id] += id === w ? game.stake * (n - 1) : -game.stake;
      lines.push(`${seg.label}: ${c.name(w)} wins (${standing})`);
      rows.push([seg.label, "Final", standing, `${c.name(w)} +${money(game.stake * (n - 1))}`]);
    } else {
      lines.push(`${seg.label}: tie, push (${standing})`);
      rows.push([seg.label, "Final", standing, "Push"]);
    }
  }
  for (const id of c.ids) net[id] = cents(net[id]);
  return {
    gameId: game.id,
    title: game.label || `Nassau (${money(game.stake)} per bet)`,
    net,
    lines,
    table: { headers: ["Bet", "Status", "Totals", "Result"], rows },
  };
}
