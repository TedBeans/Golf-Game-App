import type { Round } from "./types";
import { CATALOG } from "./catalog";
import { uid } from "./id";
import { DEFAULT_PARS, DEFAULT_SI } from "./courses";

/** A half-played sample round so the app can be tried without typing anything. */
export function demoRound(): Round {
  const players = [
    { id: "demo-mike", name: "Mike", index: 5.2 },
    { id: "demo-dave", name: "Dave", index: 11.8 },
    { id: "demo-tony", name: "Tony", index: 9.1 },
    { id: "demo-joe", name: "Joe", index: 16.4 },
  ];
  const base = { players, holes: 18 as const };
  const g = (k: string) => CATALOG.find((c) => c.key === k)!.create(base);
  const sixes = g("sixes");
  const skins = g("skins");
  const wolf = g("wolf");
  const stroke = g("stroke");
  const gross = {
    "demo-mike": [3, 5, 3, 4, 5, 4, 3, 4, 5],
    "demo-dave": [5, 6, 4, 5, 3, 5, 3, 5, 5],
    "demo-tony": [4, 5, 2, 5, 4, 4, 4, 4, 6],
    "demo-joe": [6, 6, 4, 6, 6, 5, 4, 5, 7],
  };
  const scores = Object.fromEntries(players.map((p) => [p.id, [...gross[p.id as keyof typeof gross], ...Array(9).fill(null)]]));
  const picks: ({ choice: string } | null)[] = Array(18).fill(null);
  ["demo-tony", "lone", "demo-joe", "demo-mike", "blind", "demo-dave", "lone", "demo-mike", "demo-joe"].forEach((c, i) => (picks[i] = { choice: c }));
  // hole i's wolf is players[i % 4]; make picks valid partners
  const partner = (h: number, want: string) => (want === players[h % 4].id ? players[(h + 1) % 4].id : want);
  for (let h = 0; h < 9; h++) if (picks[h] && picks[h]!.choice !== "lone" && picks[h]!.choice !== "blind") picks[h] = { choice: partner(h, picks[h]!.choice) };
  return {
    id: uid(), createdAt: Date.now(), date: new Date().toISOString().slice(0, 10), holes: 18, demo: true, status: "active",
    course: { id: "demo-course", name: "Demo Hills", tee: "Blue", pars: [...DEFAULT_PARS], strokeIndex: [...DEFAULT_SI], slope: 126, rating: 71.8 },
    players, scores, games: [sixes, skins, wolf, stroke], wolf: { [wolf.id]: picks }, bingo: {}, sideBets: [],
  };
}
