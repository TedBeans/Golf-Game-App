"use client";
import { useState } from "react";
import type { Course } from "@/lib/types";
import { blankCourse, DEFAULT_PARS, DEFAULT_SI, totalPar, type NearbyCourse } from "@/lib/courses";

type Props = { course: Course | null; holes: 9 | 18; onCourse: (c: Course) => void; onHoles: (h: 9 | 18) => void };

export default function CoursePicker({ course, holes, onCourse, onHoles }: Props) {
  const [q, setQ] = useState("");
  const [radius, setRadius] = useState(25);
  const [list, setList] = useState<NearbyCourse[] | null>(null);
  const [place, setPlace] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [manual, setManual] = useState("");
  const [edit, setEdit] = useState(false);

  async function search(params: Record<string, string>) {
    setBusy(true);
    setErr("");
    try {
      const qs = new URLSearchParams({ ...params, radius: String(radius) });
      const res = await fetch(`/api/courses?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setList(data.courses);
      setPlace(data.place || "");
      if (!data.courses.length) setErr("No courses found in that radius. Try a bigger radius or add one manually.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function useLocation() {
    if (!navigator.geolocation) return setErr("Location isn't available on this device. Search by city or ZIP instead.");
    setBusy(true);
    setErr("");
    navigator.geolocation.getCurrentPosition(
      (pos) => search({ lat: String(pos.coords.latitude), lon: String(pos.coords.longitude) }),
      () => { setBusy(false); setErr("Couldn't get your location. Allow location access or search by city or ZIP."); },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  async function pick(c: NearbyCourse) {
    const base: Course = { id: c.key, name: c.name, city: c.city, lat: c.lat, lon: c.lon, osm: c.osm, pars: [...DEFAULT_PARS], strokeIndex: [...DEFAULT_SI] };
    onCourse(base);
    if (c.osm.type === "node") return;
    try {
      const res = await fetch(`/api/course-holes?type=${c.osm.type}&id=${c.osm.id}`);
      const d = await res.json();
      onCourse({ ...base, pars: d.pars ?? base.pars, strokeIndex: d.strokeIndex ?? base.strokeIndex, parsFromMap: !!d.pars });
    } catch {
      /* keep defaults */
    }
  }

  const setPar = (i: number, v: string) => course && onCourse({ ...course, parsFromMap: false, pars: course.pars.map((p, k) => (k === i ? Math.min(6, Math.max(3, parseInt(v, 10) || 4)) : p)) });
  const setSi = (i: number, v: string) => course && onCourse({ ...course, strokeIndex: course.strokeIndex.map((p, k) => (k === i ? Math.min(18, Math.max(1, parseInt(v, 10) || 1)) : p)) });
  const siValid = course ? new Set(course.strokeIndex).size === 18 : true;

  return (
    <div>
      <div className="card">
        <div className="row wrapx">
          <button onClick={useLocation} disabled={busy}>{busy ? "Searching..." : "Courses near me"}</button>
          <select style={{ width: 110 }} value={radius} onChange={(e) => setRadius(parseInt(e.target.value, 10))}>
            {[10, 25, 50].map((r) => <option key={r} value={r}>{r} miles</option>)}
          </select>
        </div>
        <div className="row" style={{ marginTop: ".6rem" }}>
          <input placeholder="Or search a city / ZIP" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && q.trim() && search({ q })} />
          <button className="ghost" disabled={busy || !q.trim()} onClick={() => search({ q })}>Go</button>
        </div>
        {err && <div className="warn" style={{ marginTop: ".5rem" }}>{err}</div>}
        {place && <div className="muted small" style={{ marginTop: ".4rem" }}>Near {place}</div>}
        {list && list.length > 0 && (
          <div style={{ marginTop: ".6rem", maxHeight: 300, overflowY: "auto" }}>
            {list.map((c) => (
              <div key={c.key} className="row between" style={{ padding: ".5rem 0", borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => pick(c)}>
                <div><b>{c.name}</b><div className="muted small">{c.city ? c.city + " · " : ""}{c.distanceMi} mi</div></div>
                <span className={"chip" + (course?.id === c.key ? " on" : "")}>{course?.id === c.key ? "Selected" : "Select"}</span>
              </div>
            ))}
          </div>
        )}
        <div className="row" style={{ marginTop: ".8rem" }}>
          <input placeholder="Or type a course name" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button className="ghost" disabled={!manual.trim()} onClick={() => { onCourse(blankCourse(manual.trim())); setManual(""); }}>Use</button>
        </div>
      </div>

      {course && (
        <div className="card">
          <div className="row between">
            <div><b>{course.name}</b><div className="muted small">Par {totalPar(course.pars, holes)} · {course.parsFromMap ? "pars from map data" : "pars are defaults, edit if needed"}</div></div>
            <button className="ghost sm" onClick={() => setEdit((e) => !e)}>{edit ? "Done" : "Edit pars"}</button>
          </div>
          <div className="row" style={{ marginTop: ".6rem" }}>
            {[18, 9].map((h) => <span key={h} className={"chip" + (holes === h ? " on" : "")} onClick={() => onHoles(h as 9 | 18)}>{h} holes</span>)}
          </div>
          {edit && (
            <div className="scroll" style={{ marginTop: ".6rem" }}>
              <table>
                <thead><tr><th>Hole</th><th className="c">Par</th><th className="c">Stroke index</th></tr></thead>
                <tbody>
                  {course.pars.slice(0, holes).map((p, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td className="c"><input style={{ width: 64, textAlign: "center" }} inputMode="numeric" value={p} onChange={(e) => setPar(i, e.target.value)} /></td>
                      <td className="c"><input style={{ width: 64, textAlign: "center" }} inputMode="numeric" value={course.strokeIndex[i]} onChange={(e) => setSi(i, e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!siValid && <div className="warn">Stroke index should use 1-18 once each so handicap strokes land on the right holes.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
