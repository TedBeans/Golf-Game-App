"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/id";
import type { Course, Game, Round, RoundPlayer } from "@/lib/types";
import CoursePicker from "@/components/CoursePicker";
import GameEditor from "@/components/GameEditor";
import { Field, NumInput } from "@/components/ui";
import { CATALOG } from "@/lib/catalog";
import { courseHandicaps, playingHandicaps } from "@/lib/handicap";
import { range } from "@/lib/engine/ctx";

const STEPS = ["Players", "Course", "Games"] as const;

function sanitize(g: Game, ids: string[], holes: number): Game {
  const keep = (a: string[]) => a.filter((x) => ids.includes(x));
  const hs = (h: number[]) => h.filter((x) => x < holes);
  switch (g.type) {
    case "match": return { ...g, order: keep(g.order), teamA: keep(g.teamA), teamB: keep(g.teamB), segments: g.segments.filter((s) => s.from < holes).map((s) => ({ ...s, to: Math.min(s.to, holes) })) };
    case "vegas": return { ...g, teamA: keep(g.teamA), teamB: keep(g.teamB), holes: hs(g.holes) };
    default: return { ...g, playerIds: keep(g.playerIds), holes: hs(g.holes) };
  }
}

export default function NewRound() {
  const router = useRouter();
  const { state, ready, addPlayer, updatePlayer, saveRound } = useStore();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [override, setOverride] = useState<Record<string, number | undefined>>({});
  const [course, setCourse] = useState<Course | null>(null);
  const [holes, setHoles] = useState<9 | 18>(18);
  const [games, setGames] = useState<Game[]>([]);
  const [nName, setNName] = useState("");
  const [nIdx, setNIdx] = useState<number | undefined>(undefined);

  const roster = state.players;
  const players: RoundPlayer[] = useMemo(
    () => picked.map((id) => roster.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => ({ ...p, courseHcp: override[p.id] })),
    [picked, roster, override],
  );

  const draft = useMemo(() => ({ players, holes, course: course ?? { id: "", name: "", pars: [], strokeIndex: [] } }) as unknown as Round, [players, holes, course]);
  const ch = course ? courseHandicaps(draft) : {};
  const ph = course ? playingHandicaps(draft) : {};

  if (!ready) return <div className="empty">Loading…</div>;

  const toggle = (id: string) => setPicked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const move = (id: string, d: -1 | 1) => setPicked((c) => { const i = c.indexOf(id), j = i + d; if (j < 0 || j >= c.length) return c; const n = [...c]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const quickAdd = () => {
    if (!nName.trim()) return;
    const p = addPlayer(nName, nIdx ?? 0);
    setPicked((c) => [...c, p.id]); setNName(""); setNIdx(undefined);
  };

  const canNext = step === 0 ? players.length >= 2 : step === 1 ? !!course && course.name.trim().length > 0 : true;
  const start = () => {
    if (!course) return;
    const ids = players.map((p) => p.id);
    const round: Round = {
      id: uid(), createdAt: Date.now(), date: new Date().toISOString().slice(0, 10), course, holes, players,
      scores: Object.fromEntries(ids.map((id) => [id, Array(holes).fill(null)])),
      games: games.map((g) => sanitize(g, ids, holes)), wolf: {}, bingo: {}, sideBets: [], status: "active",
    };
    saveRound(round);
    router.push(`/round/${round.id}`);
  };

  return (
    <>
      <div className="top"><Link href="/" className="brand">PRESS<i>.</i></Link><Link href="/" className="btn quiet sm">Cancel</Link></div>
      <h1 className="title" style={{ marginBottom: 18 }}>New round</h1>
      <div className="steps">
        {STEPS.map((s, i) => <button key={s} className={(i === step ? "on " : "") + (i < step ? "done" : "")} onClick={() => (i <= step || canNext) && setStep(i)}>{s}</button>)}
      </div>

      {step === 0 && (
        <div className="stack">
          {roster.length > 0 && (
            <div className="card">
              <div className="label">Your players</div>
              <div className="row wrap">{roster.map((p) => <button key={p.id} className={"chip" + (picked.includes(p.id) ? " on" : "")} onClick={() => toggle(p.id)}>{p.name}</button>)}</div>
            </div>
          )}
          <div className="card">
            <div className="label">Add a player</div>
            <div className="row">
              <input className="input" placeholder="Name" value={nName} onChange={(e) => setNName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickAdd()} />
              <div style={{ width: 96 }}><NumInput className="num" placeholder="Index" value={nIdx} onChange={setNIdx} /></div>
              <button className="btn ghost" onClick={quickAdd} disabled={!nName.trim()}>Add</button>
            </div>
          </div>
          {players.length > 0 && (
            <div className="card">
              <div className="row between" style={{ marginBottom: 4 }}><div className="label" style={{ margin: 0 }}>Playing today</div><div className="small faint">Order sets Wolf and Sixes</div></div>
              <div className="divide">
                {players.map((p, i) => (
                  <div key={p.id} className="prow">
                    <span className="avatar">{i + 1}</span>
                    <div className="grow" style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ width: 84 }}><NumInput className="num" value={p.index} onChange={(n) => updatePlayer({ id: p.id, name: p.name, index: n })} /></div>
                    <button className="btn quiet sm" onClick={() => move(p.id, -1)} disabled={i === 0}>↑</button>
                    <button className="btn quiet sm" onClick={() => move(p.id, 1)} disabled={i === players.length - 1}>↓</button>
                  </div>
                ))}
              </div>
              <div className="small faint" style={{ marginTop: 8 }}>Handicap index. Everyone plays off the low man, so the best player plays to zero.</div>
            </div>
          )}
          {roster.length === 0 && players.length === 0 && <div className="empty">Add the people you're playing with.</div>}
        </div>
      )}

      {step === 1 && <CoursePicker course={course} holes={holes} onCourse={setCourse} onHoles={setHoles} />}

      {step === 2 && (
        <div className="stack">
          <div className="card">
            <div className="row between" style={{ marginBottom: 6 }}><div className="label" style={{ margin: 0 }}>Strokes today</div><span className="pill">Off the low man</span></div>
            <table className="tbl">
              <thead><tr><th>Player</th><th className="c">Index</th><th className="c">Course hcp</th><th className="c">Strokes</th></tr></thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.name}</td>
                    <td className="c">{p.index}</td>
                    <td style={{ width: 84 }}><NumInput className="num" value={override[p.id] ?? ch[p.id]} onChange={(n) => setOverride((o) => ({ ...o, [p.id]: n }))} /></td>
                    <td className="c" style={{ fontWeight: 800 }}>{ph[p.id] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="small faint" style={{ marginTop: 8 }}>Edit a course handicap if someone plays to a different number today.</div>
          </div>

          {games.map((g) => (
            <GameEditor key={g.id} game={g} players={players} holes={holes} onChange={(ng) => setGames((c) => c.map((x) => (x.id === g.id ? ng : x)))} onRemove={() => setGames((c) => c.filter((x) => x.id !== g.id))} />
          ))}

          <div>
            <div className="h2" style={{ marginTop: 6 }}>Add a game</div>
            <div className="card divide" style={{ padding: "4px 16px" }}>
              {CATALOG.map((c) => (
                <button key={c.key} className="catalog" onClick={() => setGames((g) => [...g, c.create({ players, holes })])}>
                  <span className="plus">+</span>
                  <div className="grow"><div style={{ fontWeight: 700 }}>{c.title} <span className="faint small" style={{ fontWeight: 600 }}> · {c.meta}</span></div><div className="small sub">{c.blurb}</div></div>
                </button>
              ))}
            </div>
            {games.length === 0 && <div className="small faint" style={{ marginTop: 8 }}>No games? You can still keep score, or add games later during the round.</div>}
          </div>
        </div>
      )}

      <div className="footbar"><div className="in">
        {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
        {step < 2 ? <button className="btn grow" disabled={!canNext} onClick={() => setStep(step + 1)}>{step === 0 ? (players.length < 2 ? "Pick at least 2 players" : "Course") : "Games"}</button>
          : <button className="btn accent grow" disabled={!canNext} onClick={start}>Start round</button>}
      </div></div>
      <div style={{ height: 70 }} />
    </>
  );
}
