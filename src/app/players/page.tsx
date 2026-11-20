"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";

export default function Players() {
  const { state, ready, addPlayer, updatePlayer, removePlayer, exportJson, importJson } = useStore();
  const [name, setName] = useState("");
  const [hcp, setHcp] = useState("");
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  if (!ready) return <div className="empty">Loading...</div>;

  const add = () => {
    if (!name.trim()) return;
    addPlayer(name, parseInt(hcp, 10) || 0);
    setName("");
    setHcp("");
  };

  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `golf-game-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <>
      <h1>Players</h1>
      <div className="card">
        <div className="row">
          <div className="grow"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" onKeyDown={(e) => e.key === "Enter" && add()} /></div>
          <div style={{ width: 110 }}><label>Course hcp</label><input value={hcp} inputMode="numeric" onChange={(e) => setHcp(e.target.value)} placeholder="0" /></div>
        </div>
        <div style={{ marginTop: ".7rem" }}><button onClick={add} disabled={!name.trim()}>Add player</button></div>
      </div>

      {state.players.length === 0 && <div className="empty">Add the people you play with.</div>}
      {state.players.map((p) => (
        <div key={p.id} className="card row between">
          <input style={{ flex: 1 }} defaultValue={p.name} onBlur={(e) => e.target.value.trim() && updatePlayer({ ...p, name: e.target.value.trim() })} />
          <input style={{ width: 80 }} inputMode="numeric" defaultValue={p.handicap} onBlur={(e) => updatePlayer({ ...p, handicap: parseInt(e.target.value, 10) || 0 })} />
          <button className="danger sm" onClick={() => confirm(`Remove ${p.name}? Past rounds keep their results.`) && removePlayer(p.id)}>Remove</button>
        </div>
      ))}
      <p className="muted">Handicap is the strokes a player gets on this course (course handicap). You can adjust it per round.</p>

      <h2>Backup</h2>
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>Data lives in this browser. Export a backup to move it to another phone or keep a copy.</p>
        <div className="row wrapx">
          <button className="ghost" onClick={download}>Export backup</button>
          <button className="ghost" onClick={() => file.current?.click()}>Import backup</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try { importJson(await f.text()); setMsg("Imported."); } catch (err) { setMsg(String((err as Error).message)); }
            e.target.value = "";
          }} />
        </div>
        {msg && <div className="muted" style={{ marginTop: ".5rem" }}>{msg}</div>}
      </div>
    </>
  );
}
