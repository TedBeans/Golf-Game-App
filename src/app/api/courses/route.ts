import { NextResponse } from "next/server";
import { haversineMi, type NearbyCourse } from "@/lib/courses";

export const dynamic = "force-dynamic";

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const UA = "golf-game-app/0.1 (personal golf betting tracker)";

async function overpass(query: string) {
  let lastErr: unknown;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Overpass unavailable");
}

/** Find golf courses near a point (GET ?lat=&lon=&radius=miles) or near a place name (GET ?q=). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let lat = parseFloat(searchParams.get("lat") ?? "");
  let lon = parseFloat(searchParams.get("lon") ?? "");
  const radiusMi = Math.min(60, Math.max(1, parseFloat(searchParams.get("radius") ?? "25") || 25));
  const q = searchParams.get("q")?.trim();
  let place: string | undefined;

  try {
    if ((!isFinite(lat) || !isFinite(lon)) && q) {
      const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
      });
      const arr = (await geo.json()) as { lat: string; lon: string; display_name: string }[];
      if (!arr.length) return NextResponse.json({ error: `Couldn't find "${q}". Try a city or ZIP code.` }, { status: 404 });
      lat = parseFloat(arr[0].lat);
      lon = parseFloat(arr[0].lon);
      place = arr[0].display_name;
    }
    if (!isFinite(lat) || !isFinite(lon)) return NextResponse.json({ error: "Provide lat/lon or q" }, { status: 400 });

    const meters = Math.round(radiusMi * 1609.34);
    const data = await overpass(
      `[out:json][timeout:25];nwr["leisure"="golf_course"](around:${meters},${lat},${lon});out center tags 200;`,
    );
    const seen = new Set<string>();
    const courses: NearbyCourse[] = [];
    for (const el of data.elements ?? []) {
      const name: string | undefined = el.tags?.name;
      if (!name) continue;
      const clat = el.lat ?? el.center?.lat;
      const clon = el.lon ?? el.center?.lon;
      if (typeof clat !== "number" || typeof clon !== "number") continue;
      const key = `${el.type}/${el.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      courses.push({
        key,
        name,
        city: el.tags["addr:city"],
        lat: clat,
        lon: clon,
        distanceMi: Math.round(haversineMi(lat, lon, clat, clon) * 10) / 10,
        osm: { type: el.type, id: el.id },
      });
    }
    courses.sort((a, b) => a.distanceMi - b.distanceMi);
    return NextResponse.json({ center: { lat, lon }, place, courses });
  } catch (e) {
    return NextResponse.json({ error: "Course lookup is unavailable right now. You can still add a course manually.", detail: String(e) }, { status: 502 });
  }
}
