"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { balances, everyone, nameMap, owes, winnings } from "@/lib/ledger";
import { money } from "@/lib/money";
import { Avatar, NumInput, Net } from "@/components/ui";

export default function Ledger() {
  const { state, ready, addPayment, deletePayment } = useStore();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState<number | undefined>(undefined);
  if (!ready) return <div className="empty">Loading…</div>;
  const names = nameMap(state);
  const bal = balances(state);
  const won = winnings(state);
  const people = everyone(state).filter((p) => won[p.id] !== undefined || bal[p.id] !== undefined);
  const transfers = owes(state);

  return (
    <>
      <div className="top"><span className="brand">PRESS<i>.</i></span></div>
      <h1 className="title" style={{ marginBottom: 18 }}>Balances</h1>

      <div className="card">
        <div className="label">Who owes who</div>
        {transfers.length === 0 ? <div className="sub" style={{ padding: "8px 0" }}>Everyone is square.</div> : transfers.map((t, i) => (
          <div key={i} className="owe">
            <div className="row"><Avatar name={names[t.from] ?? "?"} /><div><b>{names[t.from]}</b> <span className="sub">pays</span> <b>{names[t.to]}</b><div className="amt">{money(t.amount)}</div></div></div>
            <button className="btn ghost sm" onClick={() => addPayment({ fromId: t.from, toId: t.to, amount: t.amount })}>Mark paid</button>
          </div>
        ))}
        <div className="small faint" style={{ marginTop: 6 }}>The fewest payments that square everyone, across every round you've played. Demo rounds don't count.</div>
      </div>

      {people.length > 0 && (
        <>
          <div className="h2">Standings</div>
          <div className="card divide" style={{ padding: "4px 16px" }}>
            {[...people].sort((a, b) => (bal[b.id] ?? 0) - (bal[a.id] ?? 0)).map((p) => (
              <div key={p.id} className="prow">
                <Avatar name={p.name} /><div className="grow"><b>{p.name}</b><div className="small faint">Won/lost <Net v={won[p.id] ?? 0} /></div></div>
                <div style={{ textAlign: "right" }}><Net v={bal[p.id] ?? 0} className="big" /><div className="small faint">outstanding</div></div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="h2">Record a payment</div>
      <div className="card">
        <div className="row">
          <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}><option value="">Who paid</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Paid to</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <NumInput prefix="$" value={amt} min={0} onChange={setAmt} placeholder="Amount" />
          <button className="btn" disabled={!from || !to || from === to || !(amt && amt > 0)} onClick={() => { addPayment({ fromId: from, toId: to, amount: amt! }); setAmt(undefined); }}>Save</button>
        </div>
      </div>

      {state.payments.length > 0 && (
        <>
          <div className="h2">Payment history</div>
          <div className="card divide" style={{ padding: "4px 16px" }}>
            {state.payments.map((p) => (
              <div key={p.id} className="prow">
                <div className="grow"><b>{names[p.fromId] ?? "?"}</b> <span className="sub">paid</span> <b>{names[p.toId] ?? "?"}</b> <b>{money(p.amount)}</b><div className="small faint">{new Date(p.date).toLocaleDateString()}</div></div>
                <button className="btn quiet sm" onClick={() => deletePayment(p.id)}>Undo</button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
