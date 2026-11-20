"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppState, Payment, Player, Round } from "./types";

const KEY = "golf-game-app:v1";
const EMPTY: AppState = { version: 1, players: [], rounds: [], payments: [] };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

type Store = {
  state: AppState;
  ready: boolean;
  setState: (fn: (s: AppState) => AppState) => void;
  addPlayer: (name: string, handicap: number) => Player;
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        if (parsed && parsed.version === 1) set({ ...EMPTY, ...parsed });
      }
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked */
    }
  }, [state, ready]);

  const setState = useCallback((fn: (s: AppState) => AppState) => set((s) => fn(s)), []);

  const store = useMemo<Store>(
    () => ({
      state,
      ready,
      setState,
      addPlayer: (name, handicap) => {
        const p: Player = { id: uid(), name: name.trim(), handicap: Math.round(handicap) || 0 };
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
        const parsed = JSON.parse(json) as AppState;
        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.rounds)) throw new Error("Not a Golf Game App backup");
        set({ ...EMPTY, ...parsed });
      },
    }),
    [state, ready, setState],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}
