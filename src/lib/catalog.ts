import type { Element, Game, GameType, MatchGame, Round, Segment } from "./types";
import { uid } from "./id";
import { range } from "./engine/ctx";

export const SCORING: { key: string; label: string; blurb: string; elements: () => Element[] }[] = [
  { key: "bestBall", label: "Best ball", blurb: "Low net score of each team, totaled over the segment", elements: () => [{ id: uid(), kind: "bestBall", method: "total", points: 1 }] },
  { key: "matchPlay", label: "Match play", blurb: "Best ball, hole by hole. Win more holes, win the point", elements: () => [{ id: uid(), kind: "bestBall", method: "holes", points: 1 }] },
  { key: "combined", label: "Combined score", blurb: "Both partners' net scores added together", elements: () => [{ id: uid(), kind: "combined", method: "total", points: 1 }] },
  { key: "twoPoint", label: "Two-point game", blurb: "Every hole: 1 point for combined score + 1 point for best ball", elements: () => [
    { id: uid(), kind: "combined", method: "perHole", points: 1 },
    { id: uid(), kind: "bestBall", method: "perHole", points: 1 },
  ] },
];

export function sixSegments(holes: number, len = 6): Segment[] {
  const out: Segment[] = [];
  for (let from = 0, i = 1; from < holes; from += len, i++) out.push({ id: `s${i}`, label: `Holes ${from + 1}–${Math.min(from + len, holes)}`, from, to: Math.min(from + len, holes) });
  return out;
}

export type FixedParts = { front?: boolean; back?: boolean; overall?: boolean; whole?: boolean };
export function fixedSegments(holes: number, p: FixedParts): Segment[] {
  const out: Segment[] = [];
  if (p.front) out.push({ id: "front", label: "Front 9", from: 0, to: Math.min(9, holes) });
  if (p.back && holes === 18) out.push({ id: "back", label: "Back 9", from: 9, to: 18 });
  if (p.overall && holes === 18) out.push({ id: "overall", label: "Overall", from: 0, to: 18 });
  if (p.whole) out.push({ id: "whole", label: holes === 18 ? "18 holes" : "9 holes", from: 0, to: holes });
  return out;
}
export function fixedParts(g: MatchGame): FixedParts {
  const ids = new Set(g.segments.map((s) => s.id));
  return { front: ids.has("front"), back: ids.has("back"), overall: ids.has("overall"), whole: ids.has("whole") };
}

const allHoles = (round: { holes: number }) => range(round.holes);
const ids = (r: Pick<Round, "players">) => r.players.map((p) => p.id);

export type CatalogKey = "sixes" | "nassau" | "match" | "team" | "skins" | "stroke" | "stableford" | "wolf" | "vegas" | "bingo";

export const CATALOG: { key: CatalogKey; title: string; blurb: string; meta: string; create: (r: Pick<Round, "players" | "holes">) => Game }[] = [
  {
    key: "sixes", title: "Sixes", meta: "4 players", blurb: "Partners rotate every 6 holes so everyone partners with everyone once. Pick your scoring.",
    create: (r) => ({ id: uid(), type: "match", preset: "sixes", name: "Sixes", format: "rotate", order: ids(r).slice(0, 4), teamA: [], teamB: [], segments: sixSegments(r.holes), elements: SCORING[3].elements(), stake: 2, ties: "push" }),
  },
  {
    key: "nassau", title: "Nassau", meta: "2 to 4 players", blurb: "Front, back and overall as three separate bets between two sides.",
    create: (r) => {
      const p = ids(r), h = Math.ceil(p.length / 2);
      return { id: uid(), type: "match", preset: "nassau", name: "Nassau", format: "fixed", order: [], teamA: p.slice(0, h).slice(0, 2), teamB: p.slice(h).slice(0, 2), segments: fixedSegments(r.holes, { front: true, back: true, overall: true }), elements: SCORING[1].elements(), stake: 5, ties: "push" };
    },
  },
  {
    key: "match", title: "Match play", meta: "1 v 1 or teams", blurb: "Head to head or team v team over the whole round. Win more holes, win the match.",
    create: (r) => {
      const p = ids(r), h = Math.ceil(p.length / 2);
      return { id: uid(), type: "match", preset: "match", name: "Match play", format: "fixed", order: [], teamA: p.slice(0, h).slice(0, 2), teamB: p.slice(h).slice(0, 2), segments: fixedSegments(r.holes, { whole: true }), elements: SCORING[1].elements(), stake: 5, ties: "push" };
    },
  },
  {
    key: "team", title: "Team game", meta: "2 v 2", blurb: "Fixed teams over any segments, with the scoring you choose: best ball, combined or the two-point game.",
    create: (r) => {
      const p = ids(r);
      return { id: uid(), type: "match", preset: "twopoint", name: "Two-point game", format: "fixed", order: [], teamA: p.slice(0, 2), teamB: p.slice(2, 4), segments: fixedSegments(r.holes, { front: true, back: true, overall: true }), elements: SCORING[3].elements(), stake: 2, ties: "push" };
    },
  },
  { key: "skins", title: "Skins", meta: "Any players", blurb: "Low net score alone wins the hole. Ties can carry over.", create: (r) => ({ id: uid(), type: "skins", name: "Skins", playerIds: [], stake: 5, carryover: true, holes: allHoles(r) }) },
  { key: "stroke", title: "Stroke play", meta: "Any players", blurb: "Everyone buys in. Lowest net total takes the pot.", create: (r) => ({ id: uid(), type: "stroke", name: "Stroke play", playerIds: [], stake: 20, holes: allHoles(r) }) },
  { key: "stableford", title: "Stableford", meta: "Any players", blurb: "Points per hole against par, net. Pay the point difference.", create: (r) => ({ id: uid(), type: "stableford", name: "Stableford", playerIds: [], stake: 1, holes: allHoles(r) }) },
  { key: "wolf", title: "Wolf", meta: "3 to 5 players", blurb: "The wolf rotates, then picks a partner or goes alone.", create: (r) => ({ id: uid(), type: "wolf", name: "Wolf", playerIds: [], stake: 1, holes: allHoles(r), teamPts: 1, lonePts: 3, packPts: 1, blindMult: 2 }) },
  { key: "vegas", title: "Vegas", meta: "2 v 2", blurb: "Team scores combine into a two-digit number each hole.", create: (r) => ({ id: uid(), type: "vegas", name: "Vegas", teamA: ids(r).slice(0, 2), teamB: ids(r).slice(2, 4), stake: 0.25, holes: allHoles(r) }) },
  { key: "bingo", title: "Bingo Bango Bongo", meta: "Any players", blurb: "A point each for first on, closest once all are on, and first in.", create: (r) => ({ id: uid(), type: "bingo", name: "Bingo Bango Bongo", playerIds: [], stake: 1, holes: allHoles(r) }) },
];

export const GAME_LABEL: Record<GameType, string> = { match: "Match", skins: "Skins", stroke: "Stroke play", stableford: "Stableford", wolf: "Wolf", vegas: "Vegas", bingo: "Bingo Bango Bongo" };
