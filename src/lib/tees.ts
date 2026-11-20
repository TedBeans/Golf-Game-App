import data from "../data/courses.json";
import type { Tee } from "./types";

export type CatalogCourse = { match: string[]; name: string; city?: string; par: number; lat?: number; lon?: number; sources?: string[]; checked?: boolean; note?: string; tees: Tee[]; holes?: { hole: number; par: number; si: number; yards?: Record<string, number> }[]; holesSource?: string };

export const teeKey = (t: Tee) => `${t.name}|${t.gender ?? "M"}`;
export const teeLabel = (t: Tee) => `${t.name}${t.gender === "W" ? " (W)" : ""}`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Look a course up in the bundled tee database by (fuzzy) name. */
export function findCatalog(name?: string): CatalogCourse | null {
  const n = norm(name ?? "");
  if (!n) return null;
  const all = data as CatalogCourse[];
  // exact name first (a facility can have several courses sharing match words, like Forest Park's three loops)
  return all.find((c) => norm(c.name) === n) ?? all.find((c) => c.match.some((m) => n.includes(norm(m)))) ?? null;
}

export const allCatalog = () => data as CatalogCourse[];

/** Instant type-ahead over the bundled courses. */
export function searchCatalog(q: string): CatalogCourse[] {
  const n = norm(q);
  if (n.length < 2) return [];
  const words = n.split(" ");
  return allCatalog().filter((c) => {
    const hay = norm([c.name, c.city ?? "", ...c.match].join(" "));
    return words.every((w) => hay.includes(w));
  });
}

/** Pars and stroke indexes from a catalog course, or null when we don't have them. */
export function holeData(c: CatalogCourse | null): { pars: number[]; strokeIndex: number[] } | null {
  if (!c?.holes || c.holes.length !== 18) return null;
  const h = [...c.holes].sort((a, b) => a.hole - b.hole);
  return { pars: h.map((x) => x.par), strokeIndex: h.map((x) => x.si) };
}

/** Hole-by-hole yardage for one tee (null per hole when unknown). */
export function yardsFor(c: CatalogCourse | null, tee: string): (number | null)[] | undefined {
  if (!c?.holes) return undefined;
  const h = [...c.holes].sort((a, b) => a.hole - b.hole);
  const y = h.map((x) => x.yards?.[tee] ?? null);
  return y.some((v) => v !== null) ? y : undefined;
}
