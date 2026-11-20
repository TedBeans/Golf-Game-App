import data from "../data/courses.json";
import type { Tee } from "./types";

export type CatalogCourse = { match: string[]; name: string; city?: string; par: number; checked?: boolean; note?: string; tees: Tee[] };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Look a course up in the bundled tee database by (fuzzy) name. */
export function findCatalog(name?: string): CatalogCourse | null {
  const n = norm(name ?? "");
  if (!n) return null;
  return (data as CatalogCourse[]).find((c) => c.match.some((m) => n.includes(norm(m)))) ?? null;
}
