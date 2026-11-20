import { money, signedMoney } from "@/lib/scoring";

export function Net({ value }: { value: number }) {
  const cls = value > 0.004 ? "pos" : value < -0.004 ? "neg" : "muted";
  return <span className={cls}>{signedMoney(value)}</span>;
}

export function Transfers({ transfers, names, onPaid }: { transfers: { from: string; to: string; amount: number }[]; names: Record<string, string>; onPaid?: (t: { from: string; to: string; amount: number }) => void }) {
  if (!transfers.length) return <div className="muted">Everyone is square. Nobody owes anything.</div>;
  return (
    <div>
      {transfers.map((t, i) => (
        <div key={i} className="row between" style={{ padding: ".4rem 0", borderBottom: "1px solid var(--line)" }}>
          <div>
            <b>{names[t.from] ?? "?"}</b> owes <b>{names[t.to] ?? "?"}</b>
          </div>
          <div className="row">
            <b>{money(t.amount)}</b>
            {onPaid && <button className="sm ghost" onClick={() => onPaid(t)}>Mark paid</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
