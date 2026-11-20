"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { demoRound } from "@/lib/demo";
import { Avatar, NumInput } from "@/components/ui";

export default function Players() {
  const router = useRouter();
  const { state, ready, addPlayer, updatePlayer, removePlayer, exportJson, importJson, saveRound } = useStore();
  const [name, setName] = useState("");
  const [idx, setIdx] = useState<number | undefined>(undefined);
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  if (!ready) return <div className="empty">Loading…</div>;

  const add = () => { if (!name.trim()) return; addPlayer(name, idx ?? 0); setName(""); setIdx(undefined); };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }));
    a.download = `press-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <>
      <div className="top"><span className="brand">PRESS<i>.</i></span></div>
      <h1 className="title" style={{ marginBottom: 18 }}>Players</h1>
      <div className="card">
        <div className="label">Add a player</div>
        <div className="row">
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <div style={{ width: 96 }}><NumInput className="num" placeholder="Index" value={idx} onChange={setIdx} /></div>
          <button className="btn" onClick={add} disabled={!name.trim()}>Add</button>
        </div>
      </div>

      {state.players.length === 0 ? <div className="empty">No players yet.</div> : (
        <div className="card divide" style={{ padding: "4px 16px", marginTop: 12 }}>
          {state.players.map((p) => (
            <div key={p.id} className="prow">
              <Avatar name={p.name} />
              <input className="input grow" defaultValue={p.name} onBlur={(e) => e.target.value.trim() && updatePlayer({ ...p, name: e.target.value.trim() })} />
              <div style={{ width: 84 }}><NumInput className="num" value={p.index} onChange={(n) => updatePlayer({ ...p, index: n })} /></div>
              <button className="btn quiet sm" onClick={() => confirm(`Remove ${p.name}? Past rounds keep their results.`) && removePlayer(p.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="small faint" style={{ margin: "8px 4px" }}>Handicap index. Slope and rating are set per course when you start a round.</div>

      <div className="h2">Backup and demo</div>
      <div className="card stack8">
        <div className="sub small">Everything lives in this browser. Export a backup to move it to another phone.</div>
        <div className="row wrap">
          <button className="btn ghost sm" onClick={download}>Export backup</button>
          <button className="btn ghost sm" onClick={() => file.current?.click()}>Import backup</button>
          <button className="btn ghost sm" onClick={() => { const d = demoRound(); saveRound(d); router.push(`/round/${d.id}`); }}>Load demo round</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { importJson(await f.text()); setMsg("Imported."); } catch (err) { setMsg((err as Error).message); }
            e.target.value = "";
          }} />
        </div>
        {msg && <div className="small sub">{msg}</div>}
      </div>
    </>
  );
}
