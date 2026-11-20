"use client";
import { useMemo, useState } from "react";
import type { Course } from "@/lib/types";
import { blankCourse, DEFAULT_PARS, DEFAULT_SI, type NearbyCourse } from "@/lib/courses";
import { totalPar } from "@/lib/handicap";
import { findCatalog, teeKey, teeLabel } from "@/lib/tees";
import { Field, NumInput, Seg } from "./ui";

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
      const res = await fetch(`/api/courses?${new URLSearchParams({ ...params, radius })}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setList(data.courses); setPlace(data.place || "");
      if (!data.courses.length) setErr("No courses in that radius. Widen it or add one by name below.");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  function nearMe() {
    if (!navigator.geolocation) return setErr("Location isn't available here. Search a city or ZIP instead.");
    setBusy(true); setErr("");
    navigator.geolocation.getCurrentPosition(
      (p) => search({ lat: String(p.coords.latitude), lon: String(p.coords.longitude) }),
      () => { setBusy(false); setErr("Couldn't get your location. Allow it, or search a city or ZIP."); },
      { timeout: 10000 },
    );
  }

  async function pick(c: NearbyCourse) {
    const base: Course = { id: c.key, name: c.name, city: c.city, lat: c.lat, lon: c.lon, osm: c.osm, tee: "", pars: [...DEFAULT_PARS], strokeIndex: [...DEFAULT_SI] };
    onCourse(base);
    if (c.osm.type === "node") return;
    try {
      const d = await (await fetch(`/api/course-holes?type=${c.osm.type}&id=${c.osm.id}`)).json();
      onCourse({ ...base, pars: d.pars ?? base.pars, strokeIndex: d.strokeIndex ?? base.strokeIndex, parsFromMap: !!d.pars });
    } catch { /* keep defaults */ }
  }

  const upd = (patch: Partial<Course>) => course && onCourse({ ...course, ...patch });
  const known = useMemo(() => findCatalog(course?.name), [course?.name]);
  const [manualTee, setManualTee] = useState(false);
  const teeValue = manualTee ? "__manual" : known?.tees.find((t) => teeLabel(t) === course?.tee && t.slope === course?.slope) ? teeKey(known.tees.find((t) => teeLabel(t) === course?.tee && t.slope === course?.slope)!) : "";
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
          <select className="input" style={{ width: 112 }} value={radius} onChange={(e) => setRadius(e.target.value)}>
            {["10", "25", "50"].map((r) => <option key={r} value={r}>{r} mi</option>)}
          </select>
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
          <Field label="Course"><input className="input" value={course.name} placeholder="Course name" onChange={(e) => upd({ name: e.target.value })} /></Field>
          {known && !manualTee ? (
            <>
              <Field label="Tees">
                <select className="input" value={teeValue} onChange={(e) => chooseTee(e.target.value)}>
                  <option value="" disabled>Choose tees</option>
                  {known.tees.map((t) => <option key={teeKey(t)} value={teeKey(t)}>{teeLabel(t)} · {t.rating} / {t.slope}{t.yards ? ` · ${t.yards.toLocaleString()} yds` : ""}</option>)}
                  <option value="__manual">Other (enter manually)</option>
                </select>
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
