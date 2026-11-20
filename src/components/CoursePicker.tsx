"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Course } from "@/lib/types";
import { blankCourse, DEFAULT_PARS, DEFAULT_SI, haversineMi, type NearbyCourse } from "@/lib/courses";
import { totalPar } from "@/lib/handicap";
import { allCatalog, findCatalog, searchCatalog, teeKey, teeLabel, type CatalogCourse } from "@/lib/tees";
import { Field, NumInput, Picker, Seg, type PickOption } from "./ui";

const TEE_DOT: Record<string, string> = { black: "#18181b", gold: "#e4b43c", blue: "#3b82f6", white: "#f4f4f5", green: "#22a06b", red: "#ef4444", silver: "#a1a1aa", yellow: "#facc15", orange: "#fb923c", purple: "#a855f7" };
type Props = { course: Course | null; holes: 9 | 18; onCourse: (c: Course) => void; onHoles: (h: 9 | 18) => void };

export default function CoursePicker({ course, holes, onCourse, onHoles }: Props) {
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState("25");
  const [list, setList] = useState<NearbyCourse[] | null>(null);
  const [place, setPlace] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(false);

  async function search(params: Record<string, string>) {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/courses?${new URLSearchParams({ ...params, radius })}`, { signal: AbortSignal.timeout(20000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setList((prev) => { const known = (prev ?? []).filter((c) => c.key.startsWith("known/")); const names = new Set(known.map((c) => c.name.toLowerCase().replace(/^the /, ""))); return [...known, ...data.courses.filter((c: NearbyCourse) => !names.has(c.name.toLowerCase().replace(/^the /, "")) && !known.some((k) => findCatalog(c.name)?.name === k.name))]; }); setPlace(data.place || "");
      if (!data.courses.length && !(list && list.length)) setErr("No courses in that radius. Widen it or add one by name below.");
    } catch (e) {
      const msg = (e as Error).name === "TimeoutError" ? "The map service is slow right now. Type the course name below instead." : (e as Error).message;
      setErr(msg);
    } finally { setBusy(false); }
  }

  /** Courses we already have data for show up instantly, before the map lookup returns. */
  function showKnownNear(lat: number, lon: number) {
    const mi = parseFloat(radius);
    const near = allCatalog()
      .filter((c) => c.lat != null && c.lon != null)
      .map((c) => ({ key: `known/${c.name}`, name: c.name, city: c.city, lat: c.lat!, lon: c.lon!, distanceMi: Math.round(haversineMi(lat, lon, c.lat!, c.lon!) * 10) / 10, osm: { type: "node" as const, id: 0 } }))
      .filter((c) => c.distanceMi <= mi)
      .sort((a, b) => a.distanceMi - b.distanceMi);
    if (near.length) setList(near);
  }

  function nearMe() {
    if (!navigator.geolocation) return setErr("Location isn't available here. Search a city or ZIP instead.");
    setBusy(true); setErr("");
    navigator.geolocation.getCurrentPosition(
      (p) => { showKnownNear(p.coords.latitude, p.coords.longitude); search({ lat: String(p.coords.latitude), lon: String(p.coords.longitude) }); },
      () => { setBusy(false); setErr("Couldn't get your location. Allow it, or search a city or ZIP."); },
      { timeout: 10000 },
    );
  }

  async function pick(c: NearbyCourse) {
    if (c.key.startsWith("known/")) { pickKnown(allCatalog().find((k) => `known/${k.name}` === c.key)!); return; }
    const base: Course = { id: c.key, name: c.name, city: c.city, lat: c.lat, lon: c.lon, osm: c.osm, tee: "", pars: [...DEFAULT_PARS], strokeIndex: [...DEFAULT_SI] };
    onCourse(base);
    if (c.osm.type === "node") return;
    try {
      const d = await (await fetch(`/api/course-holes?type=${c.osm.type}&id=${c.osm.id}`)).json();
      onCourse({ ...base, pars: d.pars ?? base.pars, strokeIndex: d.strokeIndex ?? base.strokeIndex, parsFromMap: !!d.pars });
    } catch { /* keep defaults */ }
  }

  function pickKnown(k: CatalogCourse) {
    setSug([]); setManualTee(false);
    onCourse({ ...blankCourse(k.name), city: k.city, lat: k.lat, lon: k.lon });
  }

  // Type-ahead on the course name: bundled courses instantly, map names after a short pause.
  const [sug, setSug] = useState<NearbyCourse[]>([]);
  const [local, setLocal] = useState<CatalogCourse[]>([]);
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function typeName(v: string) {
    upd({ name: v, tee: "", slope: undefined, rating: undefined, teePar: undefined, tees: undefined });
    setManualTee(false);
    setLocal(searchCatalog(v));
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 3) { setSug([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const d = await (await fetch(`/api/courses?name=${encodeURIComponent(v.trim())}`, { signal: AbortSignal.timeout(8000) })).json();
        setSug((d.courses ?? []).filter((c: NearbyCourse) => !findCatalog(c.name)));
      } catch { setSug([]); }
    }, 350);
  }
  useEffect(() => { if (!course) onCourse(blankCourse("")); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const upd = (patch: Partial<Course>) => course && onCourse({ ...course, ...patch });
  const known = useMemo(() => findCatalog(course?.name), [course?.name]);
  const [manualTee, setManualTee] = useState(false);
  const teeValue = manualTee ? "__manual" : known?.tees.find((t) => teeLabel(t) === course?.tee && t.slope === course?.slope) ? teeKey(known.tees.find((t) => teeLabel(t) === course?.tee && t.slope === course?.slope)!) : "";
  const teeOptions: PickOption[] = known ? [
    ...[...known.tees].sort((a, b) => Number(a.gender === "W") - Number(b.gender === "W")).map((t) => ({ value: teeKey(t), label: teeLabel(t).replace(" (W)", ""), meta: `${t.rating} / ${t.slope}`, sub: t.yards ? `${t.yards.toLocaleString()} yds` : undefined, dot: TEE_DOT[t.name.toLowerCase()] ?? "#71717a", group: t.gender === "W" ? "Women's tees" : "Men's tees" })),
    { value: "__manual", label: "Other", sub: "Enter slope and rating yourself", group: "Not listed" },
  ] : [];
  function chooseTee(v: string) {
    if (!known) return;
    if (v === "__manual") { setManualTee(true); upd({ tees: known.tees, teePar: undefined }); return; }
    const t = known.tees.find((x) => teeKey(x) === v);
    setManualTee(false);
    if (t) upd({ tees: known.tees, tee: teeLabel(t), slope: t.slope, rating: t.rating, teePar: t.par ?? known.par });
  }
  const siOk = !course || new Set(course.strokeIndex.slice(0, 18)).size === 18;

  return (
    <div className="stack">
      <div className="card">
        <div className="row">
          <button className="btn grow" onClick={nearMe} disabled={busy}>{busy ? "Searching…" : "Courses near me"}</button>
          <Picker compact title="Search radius" value={radius} onChange={setRadius} options={["10", "25", "50"].map((r) => ({ value: r, label: `${r} mi` }))} />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input className="input" placeholder="City or ZIP" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && q.trim() && search({ q })} />
          <button className="btn ghost" disabled={busy || !q.trim()} onClick={() => search({ q })}>Search</button>
        </div>
        {err && <div className="warn" style={{ marginTop: 10 }}>{err}</div>}
        {place && <div className="small faint" style={{ marginTop: 8 }}>Near {place}</div>}
        {list && list.length > 0 && (
          <div className="divide" style={{ marginTop: 10, maxHeight: 320, overflowY: "auto" }}>
            {list.map((c) => (
              <button key={c.key} className="catalog" onClick={() => pick(c)}>
                <div className="grow"><div style={{ fontWeight: 700 }}>{c.name}</div><div className="small faint">{c.city ? `${c.city} · ` : ""}{c.distanceMi} mi</div></div>
                <span className={"pill" + (course?.id === c.key ? " live" : "")}>{course?.id === c.key ? "Selected" : "Select"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!course && (
        <button className="btn ghost block" onClick={() => onCourse(blankCourse(""))}>Enter a course manually</button>
      )}

      {course && (
        <div className="card">
          <Field label="Course">
            <input className="input" value={course.name} placeholder="Start typing a course name" autoComplete="off" onFocus={() => { setTyping(true); setLocal(searchCatalog(course.name)); }} onBlur={() => setTimeout(() => setTyping(false), 150)} onChange={(e) => typeName(e.target.value)} />
          </Field>
          {typing && (local.length > 0 || sug.length > 0) && (
            <div className="divide" style={{ marginBottom: 10, maxHeight: 240, overflowY: "auto" }}>
              {local.map((k) => (
                <button key={k.name} className="catalog" onMouseDown={(e) => e.preventDefault()} onClick={() => { pickKnown(k); setTyping(false); }}>
                  <div className="grow"><div style={{ fontWeight: 700 }}>{k.name}</div><div className="small faint">{k.city}</div></div>
                  <span className="pill live">Tees ready</span>
                </button>
              ))}
              {sug.map((c) => (
                <button key={c.key} className="catalog" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSug([]); setTyping(false); pick(c); }}>
                  <div className="grow"><div style={{ fontWeight: 700 }}>{c.name}</div><div className="small faint">{c.city}</div></div>
                </button>
              ))}
            </div>
          )}
          {known && !manualTee ? (
            <>
              <Field label="Tees">
                <Picker title="Choose tees" placeholder="Choose tees" value={teeValue} onChange={chooseTee} options={teeOptions} />
              </Field>
              {(() => { const t = known.tees.find((x) => teeKey(x) === teeValue); return t?.conflicts?.length ? <div className="warn" style={{ marginTop: 8 }}>Sources disagree on this tee: {t.conflicts.join(" · ")}</div> : null; })()}
              <div className="small faint" style={{ marginTop: 8 }}>Rating / slope for each tee are filled in for you.{known.checked ? "" : " Unverified, so check them against the scorecard."}</div>
            </>
          ) : (
            <>
              <div className="row" style={{ alignItems: "flex-end" }}>
                <div className="grow"><Field label="Tees"><input className="input" value={course.tee ?? ""} placeholder="Blue" onChange={(e) => upd({ tee: e.target.value })} /></Field></div>
                <div style={{ width: 92 }}><Field label="Slope"><NumInput className="num" value={course.slope} placeholder="113" onChange={(n) => upd({ slope: n })} /></Field></div>
                <div style={{ width: 92 }}><Field label="Rating"><NumInput className="num" value={course.rating} placeholder="72.0" onChange={(n) => upd({ rating: n })} /></Field></div>
              </div>
              <div className="small faint" style={{ marginTop: 8 }}>Slope and rating turn each player's index into a course handicap. Leave them blank to use the index as is.</div>
              {known && <button className="btn quiet sm" style={{ marginTop: 8 }} onClick={() => setManualTee(false)}>Pick from known tees</button>}
            </>
          )}
          <Field label="Holes"><Seg value={String(holes)} options={[{ value: "18", label: "18 holes" }, { value: "9", label: "9 holes" }]} onChange={(v) => onHoles(v === "9" ? 9 : 18)} /></Field>
          <div className="row between" style={{ marginTop: 14 }}>
            <div className="small sub">Par {totalPar(course.pars, holes)} · {course.parsFromMap ? "pars from map data" : "default pars, check them"}</div>
            <button className="btn ghost sm" onClick={() => setEdit((e) => !e)}>{edit ? "Done" : "Edit holes"}</button>
          </div>
          {edit && (
            <div className="scroll" style={{ marginTop: 10 }}>
              <table className="tbl">
                <thead><tr><th>Hole</th><th className="c">Par</th><th className="c">Hdcp</th><th className="c">Yds</th></tr></thead>
                <tbody>
                  {range9(holes).map((i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td style={{ width: 70 }}><NumInput className="num" value={course.pars[i]} min={3} max={6} onChange={(n) => upd({ pars: course.pars.map((p, k) => (k === i ? n : p)) })} /></td>
                      <td style={{ width: 70 }}><NumInput className="num" value={course.strokeIndex[i]} min={1} max={18} onChange={(n) => upd({ strokeIndex: course.strokeIndex.map((p, k) => (k === i ? n : p)) })} /></td>
                      <td style={{ width: 80 }}><NumInput className="num" value={course.yards?.[i] ?? undefined} min={0} onChange={(n) => { const y = [...(course.yards ?? Array(18).fill(null))]; y[i] = n; upd({ yards: y }); }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!siOk && <div className="warn" style={{ marginTop: 8 }}>Hole handicaps should use 1 to 18 once each so strokes fall on the right holes.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
const range9 = (holes: number) => Array.from({ length: holes }, (_, i) => i);
