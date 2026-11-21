"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { balances, nameMap, owes } from "@/lib/ledger";
import { computeRound } from "@/lib/engine";
import { demoRound } from "@/lib/demo";
import { money } from "@/lib/money";
import { useState } from "react";
import { ConfirmSheet, Net } from "@/components/ui";

export default function Home() {
  const router = useRouter();
  const { state, ready, saveRound, deleteRound, sync, legacyCount, importLegacy } = useStore();
  const [del, setDel] = useState<string | null>(null);
  const delRound = state.rounds.find((r) => r.id === del);
  if (!ready) return <div className="empty">Loading…</div>;
  const names = nameMap(state);
  const transfers = owes(state);
  const active = state.rounds.filter((r) => r.status === "active");
  const past = state.rounds.filter((r) => r.status === "final");
  const hasBalances = Object.keys(balances(state)).length > 0;

  const holesIn = (r: (typeof state.rounds)[number]) => Math.min(...r.players.map((p) => (r.scores[p.id] ?? []).filter((x) => typeof x === "number").length));
  const tryDemo = () => { const d = demoRound(); saveRound(d); router.push(`/round/${d.id}`); };

  return (
    <>
      <div className="top"><span className="brand">PRESS<i>.</i></span>{sync !== "local" && <span className="small faint">{sync === "synced" ? "Saved to cloud" : sync === "saving" ? "Saving…" : "Offline · will sync"}</span>}</div>
      <h1 className="title">Play for<br />something.</h1>
      <p className="sub" style={{ margin: "10px 0 20px" }}>Sixes, Nassau, skins, wolf and more. Keep score and the money settles itself.</p>
      <Link href="/new" className="btn block" style={{ padding: 18, fontSize: 17 }}>Start a round</Link>
      {legacyCount > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <b>Rounds saved only on this phone</b>
          <div className="small sub" style={{ margin: "4px 0 12px" }}>You have {legacyCount} {legacyCount === 1 ? "item" : "items"} from before accounts. Add them to your crew so they're backed up and shared.</div>
          <button className="btn block ghost" onClick={importLegacy}>Add to my crew</button>
        </div>
      )}

      {active.length > 0 && (
        <>
          <div className="h2">In progress</div>
          <div className="stack8">
            {active.map((r) => {
              const { net } = computeRound(r);
              return (
                <div key={r.id} className="rcard"><Link href={`/round/${r.id}`} className="card tap">
                  <div className="row between">
                    <div style={{ fontWeight: 800, fontSize: 17 }}>{r.course.name || "Round"}{r.demo && <span className="pill" style={{ marginLeft: 8 }}>Demo</span>}</div>
                    <span className="pill live">Thru {holesIn(r)}</span>
                  </div>
                  <div className="row wrap small" style={{ marginTop: 10, gap: 14 }}>
                    {r.players.map((p) => <span key={p.id}><span className="sub">{p.name}</span> <Net v={net[p.id] ?? 0} /></span>)}
                  </div>
                </Link>
                <button className="trash" aria-label="Delete round" onClick={() => setDel(r.id)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg></button>
              </div>
              );
            })}
          </div>
        </>
      )}

      {hasBalances && (
        <>
          <div className="h2">Who owes who</div>
          <div className="card">
            {transfers.length === 0 ? <div className="sub">Everyone is square.</div> : transfers.slice(0, 4).map((t, i) => (
              <div key={i} className="owe"><div><b>{names[t.from]}</b> <span className="sub">pays</span> <b>{names[t.to]}</b></div><div className="amt">{money(t.amount)}</div></div>
            ))}
            <Link href="/ledger" className="btn ghost block" style={{ marginTop: 6 }}>Open balances</Link>
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <div className="h2">Past rounds</div>
          <div className="stack8">
            {past.slice(0, 6).map((r) => {
              const { net } = computeRound(r);
              return (
                <div key={r.id} className="rcard"><Link href={`/round/${r.id}`} className="card tap">
                  <div className="row between"><b>{r.course.name}</b><span className="small faint">{r.date}</span></div>
                  <div className="row wrap small" style={{ marginTop: 8, gap: 14 }}>{r.players.map((p) => <span key={p.id}><span className="sub">{p.name}</span> <Net v={net[p.id] ?? 0} /></span>)}</div>
                </Link>
                <button className="trash" aria-label="Delete round" onClick={() => setDel(r.id)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg></button>
              </div>
              );
            })}
          </div>
        </>
      )}

      {state.rounds.length === 0 && (
        <div className="card flat center" style={{ marginTop: 28 }}>
          <div className="sub" style={{ marginBottom: 12 }}>Want to see it first?</div>
          <button className="btn ghost" onClick={tryDemo}>Try a demo round</button>
        </div>
      )}
    <ConfirmSheet open={!!del} title="Delete this round?" body={delRound ? `${delRound.course.name || "This round"} and any money from it will be removed. This can't be undone.` : undefined} onConfirm={() => { if (del) deleteRound(del); setDel(null); }} onClose={() => setDel(null)} />
    </>
  );
}
