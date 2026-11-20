import { NextResponse } from "next/server";
import { DEFAULT_PARS, DEFAULT_SI } from "@/lib/courses";

export const dynamic = "force-dynamic";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

/**
 * Looks for hole data (par / handicap) tagged on OpenStreetMap inside a course.
 * Many courses have it, many don't. When it's missing we return null and the app uses editable defaults.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = parseInt(searchParams.get("id") ?? "", 10);
  if (!["way", "relation"].includes(type ?? "") || !isFinite(id)) return NextResponse.json({ pars: null, strokeIndex: null });
  const sel = type === "way" ? `way(${id})` : `rel(${id})`;
  const query = `[out:json][timeout:25];${sel};map_to_area->.a;way["golf"="hole"](area.a);out tags;`;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "golf-game-app/0.1" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const pars: (number | null)[] = Array(18).fill(null);
      const si: (number | null)[] = Array(18).fill(null);
      let found = 0;
      for (const el of data.elements ?? []) {
        const ref = parseInt(el.tags?.ref ?? "", 10);
        if (!(ref >= 1 && ref <= 18)) continue;
        const par = parseInt(el.tags?.par ?? "", 10);
        const hcp = parseInt(el.tags?.handicap ?? "", 10);
        if (par >= 3 && par <= 6 && pars[ref - 1] === null) { pars[ref - 1] = par; found++; }
        if (hcp >= 1 && hcp <= 18 && si[ref - 1] === null) si[ref - 1] = hcp;
      }
      const parsOut = found >= 9 ? pars.map((p, i) => p ?? DEFAULT_PARS[i]) : null;
      const siValid = si.every((v) => v !== null) && new Set(si).size === 18;
      return NextResponse.json({ pars: parsOut, strokeIndex: siValid ? si : null, found, defaultsUsed: !parsOut, siDefault: DEFAULT_SI });
    } catch {
      /* try next mirror */
    }
  }
  return NextResponse.json({ pars: null, strokeIndex: null });
}
