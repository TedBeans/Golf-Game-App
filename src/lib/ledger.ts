import type { AppState, Player, Transfer } from "./types";
import { computeRound } from "./games";
import { cents, settle } from "./scoring";

/** Everything every player has won/lost across all rounds, before payments. */
export function winningsByPlayer(state: AppState): Record<string, number> {
  const t: Record<string, number> = {};
  for (const r of state.rounds) {
    const { net } = computeRound(r);
    for (const [id, v] of Object.entries(net)) t[id] = cents((t[id] ?? 0) + v);
  }
  return t;
}

/** Outstanding balance per player after payments. +ve = is owed money, -ve = owes money. */
export function balances(state: AppState): Record<string, number> {
  const b = winningsByPlayer(state);
  for (const p of state.payments) {
    b[p.fromId] = cents((b[p.fromId] ?? 0) + p.amount); // payer owes less
    b[p.toId] = cents((b[p.toId] ?? 0) - p.amount); // receiver is owed less
  }
  return b;
}

export function outstandingTransfers(state: AppState): Transfer[] {
  return settle(balances(state));
}

/** Name lookup that also works for players removed from the roster (uses round snapshots). */
export function nameMap(state: AppState): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of state.rounds) for (const p of r.players) m[p.id] = p.name;
  for (const p of state.players) m[p.id] = p.name;
  return m;
}

export function rosterFor(state: AppState): Player[] {
  const seen = new Set(state.players.map((p) => p.id));
  const extra: Player[] = [];
  for (const r of state.rounds) for (const p of r.players) if (!seen.has(p.id)) { seen.add(p.id); extra.push(p); }
  return [...state.players, ...extra];
}
