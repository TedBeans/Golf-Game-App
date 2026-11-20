import type { AppState, Player, Transfer } from "./types";
import { computeRound } from "./engine";
import { cents, settle } from "./money";

const real = (s: AppState) => s.rounds.filter((r) => !r.demo);

export function winnings(state: AppState): Record<string, number> {
  const t: Record<string, number> = {};
  for (const r of real(state)) for (const [id, v] of Object.entries(computeRound(r).net)) t[id] = cents((t[id] ?? 0) + v);
  return t;
}

/** + = is owed money, - = owes money, after recorded payments. */
export function balances(state: AppState): Record<string, number> {
  const b = winnings(state);
  for (const p of state.payments) {
    b[p.fromId] = cents((b[p.fromId] ?? 0) + p.amount);
    b[p.toId] = cents((b[p.toId] ?? 0) - p.amount);
  }
  return b;
}

export const owes = (s: AppState): Transfer[] => settle(balances(s));

export function nameMap(s: AppState): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of s.rounds) for (const p of r.players) m[p.id] = p.name;
  for (const p of s.players) m[p.id] = p.name;
  return m;
}

export function everyone(s: AppState): Player[] {
  const seen = new Set(s.players.map((p) => p.id));
  const extra: Player[] = [];
  for (const r of s.rounds) for (const p of r.players) if (!seen.has(p.id)) { seen.add(p.id); extra.push({ id: p.id, name: p.name, index: p.index }); }
  return [...s.players, ...extra];
}
