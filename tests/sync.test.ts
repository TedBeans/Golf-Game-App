import { describe, expect, it } from "vitest";
import type { AppState } from "../src/lib/types";
import { applyToSnapshot, applyToState, diff, snapshotOf, stable } from "../src/lib/sync";

const base = (): AppState => ({
  version: 2,
  players: [{ id: "p1", name: "Teddy", index: 11.7 }],
  rounds: [{ id: "r1", date: "2026-11-21", status: "active", scores: { p1: [4, 5] } } as never],
  payments: [],
});

describe("cloud sync diff", () => {
  it("has nothing to push when the cloud already matches", () => {
    const s = base();
    expect(diff(snapshotOf(s), s)).toEqual([]);
  });
  it("key order from Postgres jsonb does not look like a change", () => {
    const s = base();
    const snap = snapshotOf(s);
    const reordered = { ...s, players: [{ index: 11.7, name: "Teddy", id: "p1" }] } as AppState;
    expect(diff(snap, reordered)).toEqual([]);
    expect(stable({ b: 1, a: { d: 1, c: 2 } })).toBe(stable({ a: { c: 2, d: 1 }, b: 1 }));
  });
  it("pushes only what changed: an edited round, a new player, a deleted payment", () => {
    const s = base();
    s.payments = [{ id: "pay1", date: 1, fromId: "p1", toId: "p2", amount: 5 }];
    const snap = snapshotOf(s);
    const next: AppState = {
      ...s,
      rounds: [{ ...(s.rounds[0] as object), scores: { p1: [4, 5, 6] } } as never],
      players: [...s.players, { id: "p2", name: "Cam", index: 0.4 }],
      payments: [],
    };
    const d = diff(snap, next).map((c) => `${c.op}:${c.kind}:${c.id}`).sort();
    expect(d).toEqual(["delete:payments:pay1", "upsert:players:p2", "upsert:rounds:r1"]);
  });
  it("demo rounds stay on the phone", () => {
    const s = base();
    s.rounds = [...s.rounds, { id: "demo1", demo: true, status: "active" } as never];
    expect(diff(snapshotOf(base()), s)).toEqual([]);
  });
  it("a failed push is retried: the snapshot only advances after success", () => {
    const s = base();
    const snap = snapshotOf(s);
    const next = { ...s, players: [...s.players, { id: "p2", name: "Cam", index: 0 }] };
    const changes = diff(snap, next);
    expect(changes).toHaveLength(1);
    expect(diff(snap, next)).toHaveLength(1); // still pending after a failure
    const after = applyToSnapshot(snap, changes[0]);
    expect(diff(after, next)).toEqual([]);
  });
  it("remote edits and deletes apply to state without duplicating", () => {
    const s = base();
    const edited = { ...(s.rounds[0] as object), status: "final" } as never;
    const a = applyToState(s, { kind: "rounds", id: "r1", data: edited, op: "upsert" });
    expect(a.rounds).toHaveLength(1);
    expect((a.rounds[0] as { status: string }).status).toBe("final");
    const added = applyToState(a, { kind: "players", id: "p9", data: { id: "p9", name: "Leach", index: 19 }, op: "upsert" });
    expect(added.players.map((p) => p.id)).toEqual(["p1", "p9"]);
    expect(applyToState(added, { kind: "rounds", id: "r1", op: "delete" }).rounds).toEqual([]);
  });
});
