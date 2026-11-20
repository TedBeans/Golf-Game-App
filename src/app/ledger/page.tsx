"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { balances, nameMap, outstandingTransfers, rosterFor, winningsByPlayer } from "@/lib/ledger";
import { money } from "@/lib/scoring";
import { Net, Transfers } from "@/components/Money";

export default function Ledger() {
  const { state, ready, addPayment, deletePayment } = useStore();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  if (!ready) return <div className="empty">Loading...</div>;
  const names = nameMap(state);
  const bal = balances(state);
  const won = winningsByPlayer(state);
  const roster = rosterFor(state);
  const transfers = outstandingTransfers(state);

  return (
    <>
      <h1>Balances</h1>
      <div className="card">
        <h3>Who owes who</h3>
        <Transfers transfers={transfers} names={names} onPaid={(t) => addPayment({ fromId: t.from, toId: t.to, amount: t.amount })} />
        <p className="muted small" style={{ marginBottom: 0 }}>Fewest payments that square everyone up across all rounds.</p>
      </div>

      <div className="card">
        <h3>Totals</h3>
        <div className="scroll"><table>
          <thead><tr><th>Player</th><th className="c">Won/lost</th><th className="c">Outstanding</th></tr></thead>
          <tbody>
            {roster.filter((p) => won[p.id] !== undefined).sort((a, b) => (bal[b.id] ?? 0) - (bal[a.id] ?? 0)).map((p) => (
              <tr key={p.id}><td>{p.name}</td><td className="c"><Net value={won[p.id] ?? 0} /></td><td className="c"><Net value={bal[p.id] ?? 0} /></td></tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <h3>Record a payment</h3>
        <div className="row wrapx">
          <select style={{ flex: 1 }} value={from} onChange={(e) => setFrom(e.target.value)}><option value="">Who paid</option>{roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select style={{ flex: 1 }} value={to} onChange={(e) => setTo(e.target.value)}><option value="">Paid to</option>{roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input style={{ width: 100 }} inputMode="decimal" placeholder="$" value={amt} onChange={(e) => setAmt(e.target.value)} />
        </div>
        <div style={{ marginTop: ".6rem" }}>
          <button disabled={!from || !to || from === to || !(parseFloat(amt) > 0)} onClick={() => { addPayment({ fromId: from, toId: to, amount: parseFloat(amt) }); setAmt(""); }}>Save payment</button>
        </div>
      </div>

      {state.payments.length > 0 && (
        <div className="card">
          <h3>Payment history</h3>
          {state.payments.map((p) => (
            <div key={p.id} className="row between" style={{ padding: ".3rem 0", borderBottom: "1px solid var(--line)" }}>
              <div>{names[p.fromId] ?? "?"} paid {names[p.toId] ?? "?"} <b>{money(p.amount)}</b><div className="muted small">{new Date(p.date).toLocaleDateString()}</div></div>
              <button className="sm danger" onClick={() => deletePayment(p.id)}>Undo</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
