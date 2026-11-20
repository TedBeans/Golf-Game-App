"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/id";
import type { Course, Game, Round, RoundPlayer } from "@/lib/types";
import CoursePicker from "@/components/CoursePicker";
import GameEditor from "@/components/GameEditor";
import { NumInput } from "@/components/ui";
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
  const [nIdxText, setNIdxText] = useState("");
  const nIdx = (() => { const n = parseFloat(nIdxText.replace(/^\+/, "")); return isNaN(n) ? undefined : nIdxText.startsWith("+") ? -n : n; })();

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
    setPicked((c) => [...c, p.id]); setNName(""); setNIdxText("");
  };

  const canNext = step === 0 ? players.length >= 2 : step === 1 ? !!course && course.name.trim().length > 0 && !!course.holesConfirmed : true;
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

  const HEAD = [
    ["Who's playing?", "Add everyone and their handicap index."],
    ["Where are you playing?", "Search by name, or find courses near you."],
    ["What's the action?", "Everyone plays off the low man."],
  ];
  const unpicked = roster.filter((p) => !picked.includes(p.id));
  const goBack = () => (step === 0 ? router.push("/") : setStep(step - 1));
  const label = step === 0 ? (players.length < 2 ? (players.length === 1 ? "Add one more player" : "Add at least 2 players") : `Continue with ${players.length} players`) : step === 1 ? (canNext ? "Continue" : course?.name.trim() && !course.holesConfirmed ? "Confirm the hole pars first" : "Pick a course") : "Start round";
  const summary = step === 0 ? "" : step === 1 ? `${players.length} players` : `${players.length} players · ${course?.name || "Course"}${course?.tee ? " · " + course.tee : ""} · ${games.length} game${games.length === 1 ? "" : "s"}`;

  return (
    <>
      <div className="wiz-top">
        <button className="wiz-back" onClick={goBack} aria-label="Back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>
        <div className="wiz-bar">{STEPS.map((s, i) => <i key={s} className={i <= step ? "on" : ""} />)}</div>
        <span className="wiz-count">{step + 1} / 3</span>
      </div>
      <h1 className="wiz-h1">{HEAD[step][0]}</h1>
      <div className="wiz-sub">{HEAD[step][1]}</div>

      {step === 0 && (
        <div>
          <div className="addbar">
            <input className="nm" placeholder="Player name" value={nName} onChange={(e) => setNName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickAdd()} />
            <input className="ix" inputMode="decimal" placeholder="Index" value={nIdxText} onChange={(e) => { const v = e.target.value.replace(",", "."); if (/^\+?\d{0,2}\.?\d{0,1}$/.test(v) || v === "") setNIdxText(v); }} onKeyDown={(e) => e.key === "Enter" && quickAdd()} />
            <button className="go" onClick={quickAdd} disabled={!nName.trim()} aria-label="Add player">+</button>
          </div>

          {unpicked.length > 0 && (
            <>
              <div className="sec">Your players<span>tap to add</span></div>
              <div className="row wrap" style={{ gap: 8 }}>{unpicked.map((p) => <button key={p.id} className="chip add" onClick={() => toggle(p.id)}>{p.name}<span className="faint" style={{ marginLeft: 8, fontWeight: 500 }}>{p.index}</span></button>)}</div>
            </>
          )}

          {players.length > 0 && (
            <>
              <div className="sec">Playing today<span>order sets Wolf and Sixes</span></div>
              <div className="plist divide">
                {players.map((p, i) => (
                  <div key={p.id} className="prow">
                    <span className="avatar">{i + 1}</span>
                    <div className="grow" style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="ix2"><NumInput className="num" value={p.index} onChange={(n) => updatePlayer({ id: p.id, name: p.name, index: n })} /></div>
                    <button className="icon-btn" onClick={() => move(p.id, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button className="icon-btn" onClick={() => move(p.id, 1)} disabled={i === players.length - 1} aria-label="Move down">↓</button>
                    <button className="icon-btn" onClick={() => toggle(p.id)} aria-label={`Remove ${p.name}`}>✕</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {step === 1 && <CoursePicker course={course} holes={holes} onCourse={setCourse} onHoles={setHoles} />}

      {step === 2 && (
        <div className="stack">
          <details className="card acc" style={{ padding: "14px 16px" }}>
            <summary>
              <div className="row between"><span className="label" style={{ margin: 0 }}>Strokes today</span><span className="small faint">Adjust ▾</span></div>
              <div className="strokes" style={{ marginTop: 10 }}>
                {players.map((p) => <span key={p.id} className={"s" + ((ph[p.id] ?? 0) === 0 ? " zero" : "")}>{p.name}<b>{(ph[p.id] ?? 0) === 0 ? "scratch" : `+${ph[p.id]}`}</b></span>)}
              </div>
            </summary>
            <table className="tbl" style={{ marginTop: 12 }}>
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
          </details>

          {games.map((g) => (
            <GameEditor key={g.id} game={g} players={players} holes={holes} onChange={(ng) => setGames((c) => c.map((x) => (x.id === g.id ? ng : x)))} onRemove={() => setGames((c) => c.filter((x) => x.id !== g.id))} />
          ))}

          <div className="sec" style={{ marginTop: 22 }}>{games.length ? "Add another game" : "Pick your games"}<span>tap to add</span></div>
          <div className="tiles">
            {CATALOG.map((c) => {
              const nm = c.create({ players, holes }).name;
              const n = games.filter((g) => g.name === nm).length;
              return (
                <button key={c.key} className={"tile" + (n ? " hot" : "")} onClick={() => setGames((g) => [...g, c.create({ players, holes }) as unknown as Game])}>
                  {n > 0 && <span className="badge">{n}</span>}
                  <b>{c.title}</b><span className="tm">{c.meta}</span><p>{c.blurb}</p>
                </button>
              );
            })}
          </div>
          {games.length === 0 && <div className="small faint" style={{ marginTop: 12 }}>No games? You can still keep score, or add games during the round.</div>}
        </div>
      )}

      <div className="dock"><div className="in">
        {summary && <div className="note">{summary}</div>}
        <button className={"btn" + (step === 2 ? " accent" : "")} disabled={!canNext} onClick={step < 2 ? () => setStep(step + 1) : start}>{label}</button>
      </div></div>
    </>
  );
}
