"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { balances, nameMap, outstandingTransfers } from "@/lib/ledger";
import { computeRound } from "@/lib/games";
import { Net, Transfers } from "@/components/Money";

export default function Home() {
  const { state, ready, addPayment } = useStore();
  if (!ready) return <div className="empty">Loading...</div>;
  const names = nameMap(state);
  const bal = balances(state);
  const transfers = outstandingTransfers(state);
  const active = state.rounds.filter((r) => r.status === "active");
  const past = state.rounds.filter((r) => r.status === "final").slice(0, 5);

  return (
    <>
      <h1>Golf Game</h1>
      <Link href="/new" className="btn" style={{ width: "100%", textAlign: "center", padding: ".9rem" }}>+ Start a new round</Link>

      {active.length > 0 && (
        <>
          <h2>In progress</h2>
          {active.map((r) => {
            const done = Math.min(...r.playerIds.map((id) => (r.scores[id] ?? []).filter((x) => typeof x === "number").length));
            return (
              <Link key={r.id} href={`/round/${r.id}`} className="card" style={{ display: "block", color: "inherit" }}>
                <div className="row between">
                  <b>{r.course.name}</b>
                  <span className="badge">{done}/{r.holes} holes</span>
                </div>
                <div className="muted">{r.players.map((p) => p.name).join(", ")} · {r.games.length} game{r.games.length === 1 ? "" : "s"}</div>
              </Link>
            );
          })}
        </>
      )}

      <h2>Who owes who</h2>
      <div className="card">
        <Transfers transfers={transfers} names={names} onPaid={(t) => addPayment({ fromId: t.from, toId: t.to, amount: t.amount })} />
      </div>

      {Object.keys(bal).length > 0 && (
        <div className="card">
          <h3>Running balance</h3>
          <table>
            <tbody>
              {Object.entries(bal).sort((a, b) => b[1] - a[1]).map(([id, v]) => (
                <tr key={id}><td>{names[id] ?? "?"}</td><td style={{ textAlign: "right" }}><Net value={v} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2>Recent rounds</h2>
          {past.map((r) => {
            const { net } = computeRound(r);
            return (
              <Link key={r.id} href={`/round/${r.id}`} className="card" style={{ display: "block", color: "inherit" }}>
                <div className="row between"><b>{r.course.name}</b><span className="muted">{r.date}</span></div>
                <div className="row wrapx small">
                  {r.players.map((p) => <span key={p.id}>{p.name} <Net value={net[p.id] ?? 0} /></span>)}
                </div>
              </Link>
            );
          })}
        </>
      )}

      {state.rounds.length === 0 && <div className="empty">No rounds yet. Add your friends under Players, then start a round.</div>}
    </>
  );
}
