"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore, uid } from "@/lib/store";
import type { Course, GameConfig, GameType, Player, Round } from "@/lib/types";
import CoursePicker from "@/components/CoursePicker";
import GameEditor, { newGame } from "@/components/GameEditor";
import { GAME_INFO } from "@/lib/games";

export default function NewRound() {
  const router = useRouter();
  const { state, ready, addPlayer, saveRound } = useStore();
  const [course, setCourse] = useState<Course | null>(null);
  const [holes, setHoles] = useState<9 | 18>(18);
  const [picked, setPicked] = useState<string[]>([]); // ordered
  const [hcpOverride, setHcpOverride] = useState<Record<string, number>>({});
  const [games, setGames] = useState<GameConfig[]>([]);
  const [mode, setMode] = useState<Round["handicapMode"]>("full");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [nName, setNName] = useState("");
  const [nHcp, setNHcp] = useState("");
  if (!ready) return <div className="empty">Loading...</div>;

  const roster = state.players;
  const players: Player[] = picked
    .map((id) => roster.find((p) => p.id === id))
    .filter((p): p is Player => !!p)
    .map((p) => ({ ...p, handicap: hcpOverride[p.id] ?? p.handicap }));

  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const move = (id: string, d: -1 | 1) => setPicked((cur) => {
    const i = cur.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= cur.length) return cur;
    const c = [...cur]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });
  const quickAdd = () => {
    if (!nName.trim()) return;
    const p = addPlayer(nName, parseInt(nHcp, 10) || 0);
    setPicked((c) => [...c, p.id]);
    setNName(""); setNHcp("");
  };

  const ready2 = !!course && players.length >= 2;
  const siOk = !course || new Set(course.strokeIndex).size === 18;

  const start = () => {
    if (!course || players.length < 2) return;
    const ids = players.map((p) => p.id);
    const cleaned = games.map((g) => ({ ...g, playerIds: g.playerIds.filter((x) => ids.includes(x)) }));
    const round: Round = {
      id: uid(), createdAt: Date.now(), date, course, holes, playerIds: ids, players,
      handicapMode: mode,
      scores: Object.fromEntries(ids.map((id) => [id, Array(holes).fill(null)])),
      games: cleaned, wolf: {}, bingo: {}, sideBets: [], status: "active",
    };
    saveRound(round);
    router.push(`/round/${round.id}`);
  };

  return (
    <>
      <h1>New round</h1>

      <h2>1. Course</h2>
      <CoursePicker course={course} holes={holes} onCourse={setCourse} onHoles={setHoles} />

      <h2>2. Players</h2>
      <div className="card">
        {roster.length === 0 && <div className="muted">Add your first player below.</div>}
        <div className="row wrapx">
          {roster.map((p) => <span key={p.id} className={"chip" + (picked.includes(p.id) ? " on" : "")} onClick={() => toggle(p.id)}>{p.name}</span>)}
        </div>
        <div className="row" style={{ marginTop: ".7rem" }}>
          <input placeholder="New player name" value={nName} onChange={(e) => setNName(e.target.value)} />
          <input style={{ width: 80 }} placeholder="Hcp" inputMode="numeric" value={nHcp} onChange={(e) => setNHcp(e.target.value)} />
          <button className="ghost" disabled={!nName.trim()} onClick={quickAdd}>Add</button>
        </div>
        {players.length > 0 && (
          <div style={{ marginTop: ".8rem" }}>
            <div className="muted small">Playing order (used for Wolf) and handicap for this round</div>
            {players.map((p, i) => (
              <div key={p.id} className="row" style={{ marginTop: ".4rem" }}>
                <b className="grow">{i + 1}. {p.name}</b>
                <input style={{ width: 70 }} inputMode="numeric" value={p.handicap} onChange={(e) => setHcpOverride((o) => ({ ...o, [p.id]: parseInt(e.target.value, 10) || 0 }))} />
                <button className="ghost sm" onClick={() => move(p.id, -1)} disabled={i === 0}>↑</button>
                <button className="ghost sm" onClick={() => move(p.id, 1)} disabled={i === players.length - 1}>↓</button>
              </div>
            ))}
          </div>
        )}
        <label>Handicaps</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as Round["handicapMode"])}>
          <option value="full">Full handicaps</option>
          <option value="offLow">Play off the low handicap</option>
          <option value="none">No handicaps (gross)</option>
        </select>
      </div>

      <h2>3. Games</h2>
      {games.map((g) => (
        <GameEditor key={g.id} game={g} players={players} onChange={(ng) => setGames((cur) => cur.map((x) => (x.id === g.id ? ng : x)))} onRemove={() => setGames((cur) => cur.filter((x) => x.id !== g.id))} />
      ))}
      <div className="card">
        <div className="muted small" style={{ marginBottom: ".4rem" }}>Add as many games as you like. They all run at once and roll into one balance. Side bets (closest to pin, long drive) are added during the round.</div>
        <div className="row wrapx">
          {(Object.keys(GAME_INFO) as GameType[]).map((t) => (
            <button key={t} className="ghost sm" onClick={() => setGames((cur) => [...cur, newGame(t, players)])}>+ {GAME_INFO[t].name}</button>
          ))}
        </div>
      </div>

      <h2>4. Go</h2>
      <div className="card">
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {!siOk && <div className="warn" style={{ marginTop: ".5rem" }}>Stroke index has duplicates. Fix it under Edit pars or handicap strokes may land on the wrong holes.</div>}
        <div style={{ marginTop: ".8rem" }}>
          <button style={{ width: "100%", padding: ".9rem" }} disabled={!ready2} onClick={start}>Start round</button>
          {!ready2 && <div className="muted small" style={{ marginTop: ".4rem" }}>Pick a course and at least 2 players.</div>}
        </div>
      </div>
    </>
  );
}
