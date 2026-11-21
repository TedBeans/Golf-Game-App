"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppState, Payment, Player, Round } from "./types";
import { uid } from "./id";
import { useAuth } from "./auth";
import { cloudEnabled, supabase } from "./supabase";
import { KINDS, TABLE, applyToSnapshot, applyToState, diff, emptySnapshot, snapshotOf, stable, type Change, type Kind, type Snapshot } from "./sync";

const KEY = "golf-game-app:v2";
const EMPTY: AppState = { version: 2, players: [], rounds: [], payments: [] };

/** local = saved on this device only, synced = safe in the cloud, saving = pushing, offline = waiting for signal */
export type SyncStatus = "local" | "synced" | "saving" | "offline";

type Store = {
  state: AppState;
  ready: boolean;
  sync: SyncStatus;
  /** rounds/players saved on this phone from before accounts existed, not yet in the crew */
  legacyCount: number;
  importLegacy: () => void;
  addPlayer: (name: string, index: number) => Player;
  updatePlayer: (p: Player) => void;
  removePlayer: (id: string) => void;
  saveRound: (r: Round) => void;
  updateRound: (id: string, fn: (r: Round) => Round) => void;
  deleteRound: (id: string) => void;
  addPayment: (p: Omit<Payment, "id" | "date">) => void;
  deletePayment: (id: string) => void;
  exportJson: () => string;
  importJson: (json: string) => void;
};

const Ctx = createContext<Store | null>(null);
const read = <T,>(k: string): T | null => { try { const raw = localStorage.getItem(k); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; } };

export function StoreProvider({ children }: { children: ReactNode }) {
  const { status, crew, user } = useAuth();
  const crewId = cloudEnabled && status === "ready" ? crew!.id : null;
  const myId = user?.id ?? null;

  const [state, set] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<SyncStatus>(cloudEnabled ? "saving" : "local");
  const [legacyCount, setLegacyCount] = useState(0);
  const stateRef = useRef(state); stateRef.current = state;
  const snapRef = useRef<Snapshot>(emptySnapshot());
  const flushing = useRef(false);
  const again = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheKey = crewId ? `${KEY}:crew:${crewId}` : KEY;

  // ---- local-only mode (no Supabase keys): plain localStorage ----
  useEffect(() => {
    if (cloudEnabled) return;
    const p = read<AppState>(KEY);
    if (p?.version === 2) set({ ...EMPTY, ...p });
    setReady(true);
  }, []);

  // ---- cloud mode: load cache, fetch the crew, keep it live ----
  useEffect(() => {
    if (!cloudEnabled) return;
    if (!crewId) { set(EMPTY); setReady(false); snapRef.current = emptySnapshot(); return; }
    const sb = supabase()!;
    let dead = false;

    const legacy = read<AppState>(KEY);
    setLegacyCount(legacy?.version === 2 ? legacy.rounds.length + legacy.players.length : 0);

    const cached = read<{ state: AppState; snap: Snapshot }>(cacheKey);
    if (cached?.state?.version === 2) { set({ ...EMPTY, ...cached.state }); snapRef.current = cached.snap ?? snapshotOf(cached.state); setReady(true); }

    const load = async () => {
      const results = await Promise.all(KINDS.map((k) => sb.from(TABLE[k]).select("id, data").eq("crew_id", crewId)));
      if (dead) return false;
      if (results.some((r) => r.error)) return false;
      const remote: AppState = { ...EMPTY };
      for (const [i, k] of KINDS.entries()) {
        const rows = (results[i].data ?? []) as { id: string; data: unknown }[];
        (remote[k] as unknown[]) = rows.map((r) => r.data);
      }
      // Anything this phone changed that the cloud hasn't seen yet goes back on top of the fresh copy.
      const pending = diff(snapRef.current, stateRef.current);
      let merged = remote;
      for (const c of pending) merged = applyToState(merged, c);
      merged.rounds = [...merged.rounds].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      snapRef.current = snapshotOf(remote);
      set(merged);
      setReady(true);
      return true;
    };
    const loadWithRetry = async () => { if (!(await load()) && !dead) { setSync("offline"); setTimeout(loadWithRetry, 6000); } };
    loadWithRetry();

    const ch = sb.channel(`crew-${crewId}`);
    for (const k of KINDS) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: TABLE[k], filter: `crew_id=eq.${crewId}` }, (p) => {
        const row = (p.eventType === "DELETE" ? p.old : p.new) as { id: string; data?: unknown; updated_by?: string };
        if (!row?.id) return;
        if (p.eventType !== "DELETE" && row.updated_by && row.updated_by === myId) return; // our own write echoing back
        const c: Change = p.eventType === "DELETE" ? { kind: k as Kind, id: row.id, op: "delete" } : { kind: k as Kind, id: row.id, data: row.data, op: "upsert" };
        if (c.op === "upsert" && snapRef.current[k][c.id] === stable(c.data)) return;
        snapRef.current = applyToSnapshot(snapRef.current, c);
        set((s) => applyToState(s, c));
      });
    }
    ch.subscribe();
    const onOnline = () => { loadWithRetry(); flush(); };
    window.addEventListener("online", onOnline);
    return () => { dead = true; window.removeEventListener("online", onOnline); sb.removeChannel(ch); if (timer.current) clearTimeout(timer.current); if (retry.current) clearTimeout(retry.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId]);

  async function flush() {
    const sb = supabase();
    if (!sb || !crewId) return;
    if (flushing.current) { again.current = true; return; }
    flushing.current = true;
    try {
      do {
        again.current = false;
        const changes = diff(snapRef.current, stateRef.current);
        if (!changes.length) { setSync("synced"); break; }
        setSync("saving");
        let failed = false;
        for (const k of KINDS) {
          const ups = changes.filter((c) => c.kind === k && c.op === "upsert");
          const dels = changes.filter((c) => c.kind === k && c.op === "delete");
          if (ups.length) {
            const { error } = await sb.from(TABLE[k]).upsert(ups.map((c) => ({ id: c.id, crew_id: crewId, data: c.data })));
            if (error) failed = true; else for (const c of ups) snapRef.current = applyToSnapshot(snapRef.current, c);
          }
          if (dels.length) {
            const { error } = await sb.from(TABLE[k]).delete().in("id", dels.map((c) => c.id));
            if (error) failed = true; else for (const c of dels) snapRef.current = applyToSnapshot(snapRef.current, c);
          }
        }
        try { localStorage.setItem(cacheKey, JSON.stringify({ state: stateRef.current, snap: snapRef.current })); } catch { /* storage blocked */ }
        if (failed) { setSync("offline"); retry.current = setTimeout(flush, 6000); break; }
      } while (again.current);
      if (!diff(snapRef.current, stateRef.current).length) setSync("synced");
    } finally { flushing.current = false; }
  }

  // persist + push on every change
  useEffect(() => {
    if (!ready) return;
    if (!cloudEnabled) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked */ } return; }
    if (!crewId) return;
    try { localStorage.setItem(cacheKey, JSON.stringify({ state, snap: snapRef.current })); } catch { /* storage blocked */ }
    if (timer.current) clearTimeout(timer.current);
    if (diff(snapRef.current, state).length) { setSync("saving"); timer.current = setTimeout(flush, 500); } else setSync("synced");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ready, crewId]);

  const store = useMemo<Store>(() => ({
    state, ready, sync, legacyCount,
    importLegacy: () => {
      const legacy = read<AppState>(KEY);
      if (legacy?.version !== 2) return;
      set((s) => {
        const have = (k: Kind) => new Set((s[k] as { id: string }[]).map((x) => x.id));
        const pr = have("players"), rd = have("rounds"), pm = have("payments");
        return { ...s, players: [...s.players, ...legacy.players.filter((x) => !pr.has(x.id))], rounds: [...legacy.rounds.filter((x) => !rd.has(x.id)), ...s.rounds], payments: [...legacy.payments.filter((x) => !pm.has(x.id)), ...s.payments] };
      });
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      setLegacyCount(0);
    },
    addPlayer: (name, index) => {
      const p: Player = { id: uid(), name: name.trim(), index: Number.isFinite(index) ? index : 0 };
      set((s) => ({ ...s, players: [...s.players, p] }));
      return p;
    },
    updatePlayer: (p) => set((s) => ({ ...s, players: s.players.map((x) => (x.id === p.id ? p : x)) })),
    removePlayer: (id) => set((s) => ({ ...s, players: s.players.filter((x) => x.id !== id) })),
    saveRound: (r) => set((s) => ({ ...s, rounds: [r, ...s.rounds.filter((x) => x.id !== r.id)] })),
    updateRound: (id, fn) => set((s) => ({ ...s, rounds: s.rounds.map((r) => (r.id === id ? fn(r) : r)) })),
    deleteRound: (id) => set((s) => ({ ...s, rounds: s.rounds.filter((r) => r.id !== id) })),
    addPayment: (p) => set((s) => ({ ...s, payments: [{ ...p, id: uid(), date: Date.now() }, ...s.payments] })),
    deletePayment: (id) => set((s) => ({ ...s, payments: s.payments.filter((p) => p.id !== id) })),
    exportJson: () => JSON.stringify(state, null, 2),
    importJson: (json) => {
      const p = JSON.parse(json) as AppState;
      if (p?.version !== 2 || !Array.isArray(p.rounds)) throw new Error("That isn't a backup from this app");
      set({ ...EMPTY, ...p });
    },
  }), [state, ready, sync, legacyCount]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}
