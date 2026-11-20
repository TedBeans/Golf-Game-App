import type { Element, GameResult, MatchGame, Round } from "../types";
import { cents } from "../money";
import { allIds, makeCtx, range, type Ctx, zeros } from "./ctx";

const PAIRINGS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

export function teamsFor(g: MatchGame, segIndex: number): { A: string[]; B: string[] } {
  if (g.format === "fixed") return { A: g.teamA, B: g.teamB };
  const o = g.order;
  const p = PAIRINGS[segIndex % 3];
  return { A: p[0].map((i) => o[i]), B: p[1].map((i) => o[i]) };
}

export const ELEMENT_LABEL: Record<Element["kind"], string> = { bestBall: "Best ball", combined: "Combined" };

type ElementEval = { ptsA: number; ptsB: number; text: string; tie: boolean };

function evalElement(c: Ctx, el: Element, A: string[], B: string[], holes: number[], mult: number): ElementEval {
  const val = (team: string[], h: number) => {
    const s = team.map((id) => c.net(id, h)!);
    return el.kind === "bestBall" ? Math.min(...s) : s.reduce((x, y) => x + y, 0);
  };
  let a = 0, b = 0, text = "";
  if (el.method === "total") {
    for (const h of holes) { a += val(A, h); b += val(B, h); }
    text = `${ELEMENT_LABEL[el.kind]} ${a}–${b}`;
  } else {
    for (const h of holes) {
      const x = val(A, h), y = val(B, h);
      if (x < y) a++; else if (y < x) b++;
    }
    text = `${ELEMENT_LABEL[el.kind]} holes ${a}–${b}`;
    // for "holes" a bigger count wins, so flip to the same lower-wins comparison below
    a = -a; b = -b;
  }
  const pts = el.points * mult;
  if (a < b) return { ptsA: pts, ptsB: 0, text, tie: false };
  if (b < a) return { ptsA: 0, ptsB: pts, text, tie: false };
  return { ptsA: 0, ptsB: 0, text, tie: true };
}

export function match(round: Round, g: MatchGame): GameResult {
  const c = makeCtx(round);
  const label = (ids: string[]) => ids.map(c.name).join(" & ");
  const warnings: string[] = [];
  const rows: (string | number)[][] = [];
  const lines: string[] = [];
  const net = zeros(allIds(round));

  const valid =
    g.format === "rotate"
      ? g.order.length === 4 && new Set(g.order).size === 4
      : g.teamA.length > 0 && g.teamA.length === g.teamB.length && !g.teamA.some((id) => g.teamB.includes(id));
  if (!valid) {
    warnings.push(g.format === "rotate" ? "Sixes needs exactly 4 players." : "Teams must be the same size with no player on both sides.");
  }
  if (!g.elements.length) warnings.push("Add at least one scoring element.");

  let banked: Record<string, number> = {};
  // Carry-over: a tied element rolls into the next segment as a bigger multiplier (capped by maxCarry).
  const cap = g.maxCarry && g.maxCarry > 1 ? g.maxCarry : Infinity;
  let carry: number[] = g.elements.map(() => 0);
  let prevTo = 0;
  let liveNote = "";
  if (valid && g.elements.length) {
    g.segments.forEach((seg, si) => {
      const holes = range(Math.min(seg.to, round.holes) - seg.from).map((i) => seg.from + i).filter((h) => h < round.holes);
      if (!holes.length) return;
      if (seg.from < prevTo) carry = carry.map(() => 0); // overlapping segments (e.g. a Nassau's overall bet) don't carry
      const { A, B } = teamsFor(g, si);
      const players = [...A, ...B];
      const finished = holes.filter((h) => c.done(players, h));
      if (!finished.length) { rows.push([seg.label, `${label(A)} v ${label(B)}`, "Not started", "", ""]); return; }
      const complete = finished.length === holes.length;
      let pa = 0, pb = 0;
      const texts: string[] = [];
      const nextCarry = [...carry];
      g.elements.forEach((el, ei) => {
        const mult = g.ties === "carry" ? 1 + carry[ei] : 1;
        const r = evalElement(c, el, A, B, finished, mult);
        pa += r.ptsA; pb += r.ptsB;
        texts.push(r.text + (mult > 1 ? ` ×${mult}` : "") + (r.tie && g.ties === "carry" && complete ? " · tied, carries" : ""));
        if (complete && g.ties === "carry") nextCarry[ei] = r.tie ? Math.min(carry[ei] + 1, cap - 1) : 0;
      });
      if (complete) { carry = nextCarry; prevTo = seg.to; }
      const margin = cents(pa - pb);
      if (complete) {
        for (const id of A) net[id] = cents(net[id] + margin * g.stake);
        for (const id of B) net[id] = cents(net[id] - margin * g.stake);
        for (const id of A) banked[id] = (banked[id] ?? 0) + margin;
        for (const id of B) banked[id] = (banked[id] ?? 0) - margin;
      } else {
        const lead = margin > 0 ? `${label(A)} lead` : margin < 0 ? `${label(B)} lead` : "All square";
        liveNote = `${seg.label} thru ${finished.length}: ${lead}${margin ? ` ${Math.abs(margin)}–0 pts` : ""}`;
      }
      rows.push([seg.label, `${label(A)} v ${label(B)}`, texts.join(" · "), `${pa}–${pb}`, complete ? "Final" : "Live"]);
    });
  }
  lines.push(...rows.map((r) => `${r[0]}: ${r[1]} (${r[3] || "-"})`));
  const total = Object.values(net).reduce((x, y) => x + Math.abs(y), 0);
  return {
    gameId: g.id,
    title: g.name,
    subtitle: g.elements.map((e) => `${e.points} pt ${ELEMENT_LABEL[e.kind].toLowerCase()}${e.method === "holes" ? " (holes)" : ""}`).join(" + "),
    net,
    status: liveNote || (total ? "Settled segments counted" : "No segments settled yet"),
    lines,
    warnings,
    table: { headers: ["Segment", "Teams", "Scoring", "Pts", ""], rows },
  };
}
