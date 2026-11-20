import data from "../data/courses.json";
import type { Tee } from "./types";

export type CatalogCourse = { match: string[]; name: string; city?: string; par: number; lat?: number; lon?: number; sources?: string[]; checked?: boolean; note?: string; tees: Tee[] };

export const teeKey = (t: Tee) => `${t.name}|${t.gender ?? "M"}`;
export const teeLabel = (t: Tee) => `${t.name}${t.gender === "W" ? " (W)" : ""}`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Look a course up in the bundled tee database by (fuzzy) name. */
export function findCatalog(name?: string): CatalogCourse | null {
  const n = norm(name ?? "");
  if (!n) return null;
  return (data as CatalogCourse[]).find((c) => c.match.some((m) => n.includes(norm(m)))) ?? null;
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
