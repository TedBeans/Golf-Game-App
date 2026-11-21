import type { BingoGame, GameResult, Round, SkinsGame, StablefordGame, StrokeGame, VegasGame, WolfGame } from "../types";
import { cents, money } from "../money";
import { allIds, makeCtx, zeros } from "./ctx";

const pids = (r: Round, ids: string[]) => (ids.length ? ids.filter((id) => r.players.some((p) => p.id === id)) : allIds(r));
const holeList = (r: Round, holes: number[]) => [...holes].filter((h) => h < r.holes).sort((a, b) => a - b);

export function pairwise(ids: string[], pts: Record<string, number>, stake: number) {
  const net = zeros(ids);
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const d = (pts[ids[i]] - pts[ids[j]]) * stake;
      net[ids[i]] += d;
      net[ids[j]] -= d;
    }
  for (const id of ids) net[id] = cents(net[id]);
  return net;
}

export function skins(round: Round, g: SkinsGame): GameResult {
  const c = makeCtx(round);
  const ids = pids(round, g.playerIds);
  const net = zeros(allIds(round));
  const rows: (string | number)[][] = [];
  const won: Record<string, number> = {};
  let carry = 0;
  let cleared = 0;
  for (const h of holeList(round, g.holes)) {
    if (!c.done(ids, h)) break;
    cleared++;
    const s = ids.map((id) => ({ id, v: c.net(id, h)! }));
    const low = Math.min(...s.map((x) => x.v));
    const w = s.filter((x) => x.v === low);
    const worth = g.stake * (1 + carry);
    if (w.length === 1) {
      const id = w[0].id;
      for (const p of ids) net[p] += p === id ? worth * (ids.length - 1) : -worth;
      won[id] = (won[id] ?? 0) + 1 + carry;
      rows.push([h + 1, c.name(id), carry + 1, money(worth * (ids.length - 1))]);
      carry = 0;
    } else if (g.carryover) {
      carry++;
      rows.push([h + 1, "Carry", carry, "-"]);
    } else rows.push([h + 1, "Tie", 0, "-"]);
  }
  for (const k of Object.keys(net)) net[k] = cents(net[k]);
  const tally = Object.entries(won).map(([id, n]) => `${c.name(id)} ${n}`).join(", ");
  return {
    gameId: g.id, title: g.name, subtitle: `${money(g.stake)} per skin${g.carryover ? " · carryover" : ""}`, net,
    status: `${tally || "No skins yet"}${carry ? ` · ${carry + 1} riding` : ""}`,
    lines: [], table: { headers: ["Hole", "Winner", "Skins", "Won"], rows },
  };
}

export function stroke(round: Round, g: StrokeGame): GameResult {
  const c = makeCtx(round);
  const ids = pids(round, g.playerIds);
  const hs = holeList(round, g.holes);
  const net = zeros(allIds(round));
  const tot: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  let counted = 0;
  for (const h of hs) {
    if (!c.done(ids, h)) continue;
    counted++;
    for (const id of ids) tot[id] += c.net(id, h)!;
  }
  const finished = counted === hs.length && hs.length > 0;
  if (counted > 0) { // live: the current leader holds the pot until someone passes them
    const low = Math.min(...ids.map((id) => tot[id]));
    const winners = ids.filter((id) => tot[id] === low);
    const pot = g.stake * ids.length;
    for (const id of ids) net[id] = cents(-g.stake + (winners.includes(id) ? pot / winners.length : 0));
  }
  const sorted = [...ids].sort((a, b) => tot[a] - tot[b]);
  return {
    gameId: g.id, title: g.name, subtitle: `${money(g.stake)} buy-in · low net wins the pot`, net,
    status: finished ? `${sorted.map((i) => c.name(i)).slice(0, 1)} wins` : `Thru ${counted}: ${sorted.map((id) => `${c.name(id)} ${tot[id]}`).join(" · ")}`,
    lines: [], table: { headers: ["Player", "Net"], rows: sorted.map((id) => [c.name(id), tot[id]]) },
  };
}

export function stableford(round: Round, g: StablefordGame): GameResult {
  const c = makeCtx(round);
  const ids = pids(round, g.playerIds);
  const pts: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const h of holeList(round, g.holes)) {
    if (!c.done(ids, h)) continue;
    for (const id of ids) pts[id] += Math.max(0, 2 - (c.net(id, h)! - c.par(h)));
  }
  const net = { ...zeros(allIds(round)), ...pairwise(ids, pts, g.stake) };
  const sorted = [...ids].sort((a, b) => pts[b] - pts[a]);
  return {
    gameId: g.id, title: g.name, subtitle: `${money(g.stake)} per point · net`, net,
    status: sorted.map((id) => `${c.name(id)} ${pts[id]}`).join(" · "),
    lines: [], table: { headers: ["Player", "Points"], rows: sorted.map((id) => [c.name(id), pts[id]]) },
  };
}

export function wolfOrder(round: Round, g: WolfGame) { return pids(round, g.playerIds); }

export function wolf(round: Round, g: WolfGame): GameResult {
  const c = makeCtx(round);
  const ids = pids(round, g.playerIds);
  const picks = round.wolf?.[g.id] ?? [];
  const pts: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const rows: (string | number)[][] = [];
  const warnings: string[] = [];
  if (ids.length < 3) warnings.push("Wolf needs 3 to 5 players.");
  else
    for (const h of holeList(round, g.holes)) {
      const wolfId = ids[h % ids.length];
      const pick = picks[h];
      if (!c.done(ids, h) || !pick) continue;
      const best = (xs: string[]) => Math.min(...xs.map((id) => c.net(id, h)!));
      const pack = ids.filter((id) => id !== wolfId);
      if (pick.choice === "lone" || pick.choice === "blind") {
        const m = pick.choice === "blind" ? g.blindMult : 1;
        const w = c.net(wolfId, h)!, o = best(pack);
        if (w < o) { pts[wolfId] += g.lonePts * m; rows.push([h + 1, c.name(wolfId), pick.choice, `Wolf +${g.lonePts * m}`]); }
        else if (w > o) { for (const id of pack) pts[id] += g.packPts * m; rows.push([h + 1, c.name(wolfId), pick.choice, `Pack +${g.packPts * m} each`]); }
        else rows.push([h + 1, c.name(wolfId), pick.choice, "Tie"]);
      } else {
        const team = [wolfId, pick.choice];
        const rest = ids.filter((id) => !team.includes(id));
        if (!ids.includes(pick.choice) || !rest.length) continue;
        const a = best(team), b = best(rest);
        if (a < b) { for (const id of team) pts[id] += g.teamPts; rows.push([h + 1, c.name(wolfId), `+ ${c.name(pick.choice)}`, `Team +${g.teamPts} each`]); }
        else if (a > b) { for (const id of rest) pts[id] += g.teamPts; rows.push([h + 1, c.name(wolfId), `+ ${c.name(pick.choice)}`, `Others +${g.teamPts} each`]); }
        else rows.push([h + 1, c.name(wolfId), `+ ${c.name(pick.choice)}`, "Tie"]);
      }
    }
  const net = { ...zeros(allIds(round)), ...pairwise(ids, pts, g.stake) };
  const sorted = [...ids].sort((a, b) => pts[b] - pts[a]);
  return {
    gameId: g.id, title: g.name, subtitle: `${money(g.stake)} per point`, net, warnings,
    status: sorted.map((id) => `${c.name(id)} ${pts[id]}`).join(" · "),
    lines: [], table: { headers: ["Hole", "Wolf", "Pick", "Result"], rows },
  };
}

export function vegas(round: Round, g: VegasGame): GameResult {
  const c = makeCtx(round);
  const net = zeros(allIds(round));
  const warnings: string[] = [];
  const rows: (string | number)[][] = [];
  const ok = g.teamA.length === 2 && g.teamB.length === 2;
  if (!ok) warnings.push("Vegas needs 2 players on each team.");
  let swing = 0;
  if (ok) {
    const all = [...g.teamA, ...g.teamB];
    const combo = (t: string[], h: number) => {
      const s = t.map((id) => Math.max(1, c.net(id, h)!)).sort((x, y) => x - y);
      return s[0] * 10 + s[1];
    };
    for (const h of holeList(round, g.holes)) {
      if (!c.done(all, h)) continue;
      const a = combo(g.teamA, h), b = combo(g.teamB, h);
      const d = b - a;
      swing += d;
      for (const id of g.teamA) net[id] += d * g.stake;
      for (const id of g.teamB) net[id] -= d * g.stake;
      rows.push([h + 1, a, b, d === 0 ? "Push" : `${d > 0 ? "A" : "B"} +${Math.abs(d)}`]);
    }
    for (const k of Object.keys(net)) net[k] = cents(net[k]);
  }
  const names = (t: string[]) => t.map(c.name).join(" & ");
  return {
    gameId: g.id, title: g.name, subtitle: `${money(g.stake)} per point, per player`, net, warnings,
    status: !ok ? "Set teams" : swing === 0 ? "All square" : `${swing > 0 ? names(g.teamA) : names(g.teamB)} up ${Math.abs(swing)}`,
    lines: [], table: { headers: ["Hole", "Team A", "Team B", "Swing"], rows },
  };
}

export function bingo(round: Round, g: BingoGame): GameResult {
  const c = makeCtx(round);
  const ids = pids(round, g.playerIds);
  const data = round.bingo?.[g.id] ?? [];
  const pts: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const h of holeList(round, g.holes)) {
    const d = data[h];
    if (!d) continue;
    for (const k of ["bingo", "bango", "bongo"] as const) { const id = d[k]; if (id && pts[id] !== undefined) pts[id]++; }
  }
  const net = { ...zeros(allIds(round)), ...pairwise(ids, pts, g.stake) };
  const sorted = [...ids].sort((a, b) => pts[b] - pts[a]);
  return {
    gameId: g.id, title: g.name, subtitle: `${money(g.stake)} per point`, net,
    status: sorted.map((id) => `${c.name(id)} ${pts[id]}`).join(" · "),
    lines: [], table: { headers: ["Player", "Points"], rows: sorted.map((id) => [c.name(id), pts[id]]) },
  };
}
