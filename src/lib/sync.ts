import type { AppState } from "./types";

export type Kind = "rounds" | "players" | "payments";
export const KINDS: Kind[] = ["rounds", "players", "payments"];
export const TABLE: Record<Kind, string> = { rounds: "crew_rounds", players: "crew_players", payments: "crew_payments" };
/** id -> stable JSON of the last version we know the cloud has */
export type Snapshot = Record<Kind, Record<string, string>>;

/** JSON with sorted keys, so Postgres jsonb reordering never looks like a change. */
export function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : val);
}

export const emptySnapshot = (): Snapshot => ({ rounds: {}, players: {}, payments: {} });

export function snapshotOf(s: AppState): Snapshot {
  const out = emptySnapshot();
  for (const k of KINDS) for (const item of s[k] as { id: string }[]) out[k][item.id] = stable(item);
  return out;
}

export type Change = { kind: Kind; id: string; data?: unknown; op: "upsert" | "delete" };

/** What has to be pushed so the cloud matches `s`, given what it already has. */
export function diff(snap: Snapshot, s: AppState): Change[] {
  const out: Change[] = [];
  for (const k of KINDS) {
    const seen = new Set<string>();
    for (const item of s[k] as { id: string; demo?: boolean }[]) {
      if (item.demo) continue; // demo rounds stay on this phone
      seen.add(item.id);
      if (snap[k][item.id] !== stable(item)) out.push({ kind: k, id: item.id, data: item, op: "upsert" });
    }
    for (const id of Object.keys(snap[k])) if (!seen.has(id)) out.push({ kind: k, id, op: "delete" });
  }
  return out;
}

/** Apply one change into a snapshot (used after a successful push or a remote update). */
export function applyToSnapshot(snap: Snapshot, c: Change): Snapshot {
  const next = { ...snap, [c.kind]: { ...snap[c.kind] } };
  if (c.op === "delete") delete next[c.kind][c.id];
  else next[c.kind][c.id] = stable(c.data);
  return next;
}

/** Apply one change to the app state. */
export function applyToState(s: AppState, c: Change): AppState {
  const list = s[c.kind] as { id: string }[];
  const rest = list.filter((x) => x.id !== c.id);
  if (c.op === "delete") return { ...s, [c.kind]: rest } as AppState;
  const item = c.data as { id: string };
  const had = list.some((x) => x.id === c.id);
  // keep position for existing items, newest first for new rounds/payments, append players
  const merged = had ? list.map((x) => (x.id === c.id ? item : x)) : c.kind === "players" ? [...rest, item] : [item, ...rest];
  return { ...s, [c.kind]: merged } as AppState;
}
