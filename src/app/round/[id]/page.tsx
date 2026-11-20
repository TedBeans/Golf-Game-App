"use client";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useStore, uid } from "@/lib/store";
import type { GameType, Round, SideBet } from "@/lib/types";
import { computeRound, GAME_INFO } from "@/lib/games";
import { makeCtx, money, playingHandicaps, roundStrokeIndex, strokesOnHole } from "@/lib/scoring";
import { Net, Transfers } from "@/components/Money";
import GameEditor, { newGame } from "@/components/GameEditor";

type Tab = "score" | "results" | "bets";

export default function RoundPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, ready, updateRound, deleteRound } = useStore();
  const round = state.rounds.find((r) => r.id === id);
  const [tab, setTab] = useState<Tab>("score");
  const [hole, setHole] = useState(0);
  const computed = useMemo(() => (round ? computeRound(round) : null), [round]);

  if (!ready) return <div className="empty">Loading...</div>;
  if (!round || !computed) return <div className="empty">Round not found. <Link href="/">Home</Link></div>;

  const upd = (fn: (r: Round) => Round) => updateRound(round.id, fn);
  const names = Object.fromEntries(round.players.map((p) => [p.id, p.name]));
  const locked = round.status === "final";

  return (
    <>
      <div className="row between">
        <div>
          <h1 style={{ marginBottom: 0 }}>{round.course.name}</h1>
          <div className="muted">{round.date} · {round.holes} holes{locked ? " · Final" : ""}</div>
        </div>
        <Link href="/" className="btn ghost sm">Home</Link>
      </div>
      <div className="tabs">
        {([["score", "Scorecard"], ["results", "Money"], ["bets", "Games & bets"]] as [Tab, string][]).map(([t, l]) => (
          <span key={t} className={"chip" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{l}</span>
        ))}
      </div>

      {tab === "score" && <ScoreTab round={round} hole={hole} setHole={setHole} upd={upd} locked={locked} />}

      {tab === "results" && (
        <>
          <div className="card">
            <h3>Round total</h3>
            <table><tbody>
              {Object.entries(computed.net).sort((a, b) => b[1] - a[1]).map(([pid, v]) => (
                <tr key={pid}><td>{names[pid]}</td><td style={{ textAlign: "right" }}><Net value={v} /></td></tr>
              ))}
            </tbody></table>
          </div>
          <div className="card">
            <h3>Who owes who (this round)</h3>
            <Transfers transfers={computed.transfers} names={names} />
          </div>
          {computed.results.map((r) => (
            <div key={r.gameId} className="card">
              <div className="row between"><h3>{r.title}</h3></div>
              {r.warnings?.map((w, i) => <div key={i} className="warn">{w}</div>)}
              <div className="row wrapx small" style={{ marginBottom: ".4rem" }}>
                {Object.entries(r.net).map(([pid, v]) => <span key={pid}>{names[pid]} <Net value={v} /></span>)}
              </div>
              {r.table && r.table.rows.length > 0 ? (
                <div className="scroll"><table>
                  <thead><tr>{r.table.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{r.table.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
                </table></div>
              ) : (
                r.lines.map((l, i) => <div key={i} className="muted small">{l}</div>)
              )}
            </div>
          ))}
          {computed.results.length === 0 && <div className="empty">No games yet. Add one under Games &amp; bets.</div>}
          <div className="row wrapx">
            {locked ? (
              <button className="ghost" onClick={() => upd((r) => ({ ...r, status: "active" }))}>Reopen round</button>
            ) : (
              <button onClick={() => { upd((r) => ({ ...r, status: "final" })); router.push("/ledger"); }}>Finish round &amp; add to balances</button>
            )}
            <button className="danger" onClick={() => { if (confirm("Delete this round and its money?")) { deleteRound(round.id); router.push("/"); } }}>Delete</button>
          </div>
          <p className="muted small">Active rounds already count toward your balances. Finishing just marks the round complete.</p>
        </>
      )}

      {tab === "bets" && <BetsTab round={round} upd={upd} locked={locked} />}
    </>
  );
}

function ScoreTab({ round, hole, setHole, upd, locked }: { round: Round; hole: number; setHole: (h: number) => void; upd: (fn: (r: Round) => Round) => void; locked: boolean }) {
  const si = roundStrokeIndex(round);
  const hcps = playingHandicaps(round);
  const par = round.course.pars[hole];
  const setScore = (pid: string, v: number | null) =>
    upd((r) => ({ ...r, scores: { ...r.scores, [pid]: (r.scores[pid] ?? Array(r.holes).fill(null)).map((x, i) => (i === hole ? v : x)) } }));
  const holeDone = (h: number) => round.playerIds.every((p) => typeof round.scores[p]?.[h] === "number");
  const totals = (pid: string) => {
    const arr = round.scores[pid] ?? [];
    let g = 0, p = 0;
    arr.forEach((s, i) => { if (typeof s === "number") { g += s; p += round.course.pars[i]; } });
    return { g, toPar: g - p, any: arr.some((s) => typeof s === "number") };
  };
  const toParStr = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

  const wolfGames = round.games.filter((g) => g.type === "wolf");
  const bingoGames = round.games.filter((g) => g.type === "bingo");

  return (
    <>
      <div className="holebar">
        {Array.from({ length: round.holes }, (_, i) => (
          <button key={i} className={(hole === i ? "on " : "") + (holeDone(i) ? "done" : "")} onClick={() => setHole(i)}>{i + 1}</button>
        ))}
      </div>
      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Hole {hole + 1}</h2>
          <span className="badge">Par {par} · SI {round.course.strokeIndex[hole]}</span>
        </div>
        {round.players.map((p) => {
          const s = round.scores[p.id]?.[hole] ?? null;
          const k = strokesOnHole(hcps[p.id] ?? 0, si[hole], round.holes);
          const t = totals(p.id);
          return (
            <div key={p.id} className="row between" style={{ padding: ".6rem 0", borderTop: "1px solid var(--line)" }}>
              <div>
                <b>{p.name}</b> {k !== 0 && <span className="badge">{k > 0 ? "•".repeat(Math.min(k, 3)) : "plus"} {k > 0 ? `${k} stroke${k > 1 ? "s" : ""}` : ""}</span>}
                <div className="muted small">{t.any ? `${t.g} (${toParStr(t.toPar)})` : "-"}</div>
              </div>
              <div className="stepper">
                <button disabled={locked} onClick={() => setScore(p.id, Math.max(1, (s ?? par + 1) - 1))}>−</button>
                <span className="val">{s ?? "-"}</span>
                <button disabled={locked} onClick={() => setScore(p.id, Math.min(15, (s ?? par - 1) + 1))}>+</button>
              </div>
            </div>
          );
        })}
        <div className="row between" style={{ marginTop: ".6rem" }}>
          <button className="ghost" disabled={hole === 0} onClick={() => setHole(hole - 1)}>← Prev</button>
          <button disabled={hole === round.holes - 1} onClick={() => setHole(hole + 1)}>Next hole →</button>
        </div>
      </div>

      {wolfGames.map((g) => {
        const order = (g.playerIds.length ? g.playerIds : round.playerIds);
        const wolfId = order[hole % order.length];
        const cur = round.wolf?.[g.id]?.[hole]?.choice;
        const setPick = (choice: string | null) =>
          upd((r) => {
            const arr = [...(r.wolf?.[g.id] ?? Array(r.holes).fill(null))];
            arr[hole] = choice ? { choice } : null;
            return { ...r, wolf: { ...r.wolf, [g.id]: arr } };
          });
        return (
          <div key={g.id} className="card">
            <h3>Wolf: {round.players.find((p) => p.id === wolfId)?.name} is the wolf</h3>
            <div className="row wrapx">
              {order.filter((id) => id !== wolfId).map((id) => (
                <span key={id} className={"chip" + (cur === id ? " on" : "")} onClick={() => !locked && setPick(cur === id ? null : id)}>with {round.players.find((p) => p.id === id)?.name}</span>
              ))}
              <span className={"chip" + (cur === "lone" ? " on" : "")} onClick={() => !locked && setPick(cur === "lone" ? null : "lone")}>Lone wolf</span>
              <span className={"chip" + (cur === "blind" ? " on" : "")} onClick={() => !locked && setPick(cur === "blind" ? null : "blind")}>Blind wolf</span>
            </div>
            {!cur && <div className="warn" style={{ marginTop: ".4rem" }}>No pick recorded: this hole won't count for Wolf.</div>}
          </div>
        );
      })}

      {bingoGames.map((g) => {
        const ids = g.playerIds.length ? g.playerIds : round.playerIds;
        const cur = round.bingo?.[g.id]?.[hole] ?? {};
        const set = (k: "bingo" | "bango" | "bongo", v: string) =>
          upd((r) => {
            const arr = [...(r.bingo?.[g.id] ?? Array(r.holes).fill(null))];
            arr[hole] = { ...(arr[hole] ?? {}), [k]: v || undefined };
            return { ...r, bingo: { ...r.bingo, [g.id]: arr } };
          });
        return (
          <div key={g.id} className="card">
            <h3>Bingo Bango Bongo</h3>
            {([["bingo", "Bingo: first on the green"], ["bango", "Bango: closest once all on"], ["bongo", "Bongo: first in the hole"]] as const).map(([k, l]) => (
              <div key={k} className="row" style={{ marginBottom: ".4rem" }}>
                <span style={{ width: 170 }} className="small">{l}</span>
                <select disabled={locked} value={cur[k] ?? ""} onChange={(e) => set(k, e.target.value)}>
                  <option value="">-</option>
                  {ids.map((id) => <option key={id} value={id}>{round.players.find((p) => p.id === id)?.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        );
      })}

      <div className="card scroll">
        <h3>Scorecard</h3>
        <table>
          <thead><tr><th>Hole</th>{round.players.map((p) => <th key={p.id} className="c">{p.name.slice(0, 6)}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: round.holes }, (_, i) => (
              <tr key={i} onClick={() => setHole(i)} style={{ cursor: "pointer", background: i === hole ? "var(--panel2)" : undefined }}>
                <td>{i + 1} <span className="muted small">par {round.course.pars[i]}</span></td>
                {round.players.map((p) => <td key={p.id} className="c">{round.scores[p.id]?.[i] ?? "-"}</td>)}
              </tr>
            ))}
            <tr><td><b>Total</b></td>{round.players.map((p) => <td key={p.id} className="c"><b>{totals(p.id).any ? totals(p.id).g : "-"}</b></td>)}</tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

const PRESETS = ["Closest to pin", "Long drive", "Greenie", "Sandie", "Birdie pot"];

function BetsTab({ round, upd, locked }: { round: Round; upd: (fn: (r: Round) => Round) => void; locked: boolean }) {
  const [label, setLabel] = useState(PRESETS[0]);
  const [amount, setAmount] = useState("2");
  const [hole, setHole] = useState("");
  const addBet = () => {
    const b: SideBet = { id: uid(), label: label.trim() || "Side bet", amount: Math.max(0, parseFloat(amount) || 0), winnerId: null, hole: parseInt(hole, 10) || undefined };
    upd((r) => ({ ...r, sideBets: [...r.sideBets, b] }));
  };
  const ctxPlayers = round.players;
  return (
    <>
      <h2 style={{ marginTop: 0 }}>Side bets</h2>
      <div className="card">
        <div className="muted small">The winner collects the amount from every other player. Add one per contest (e.g. closest to pin on each par 3).</div>
        <div className="row wrapx" style={{ margin: ".5rem 0" }}>
          {PRESETS.map((p) => <span key={p} className={"chip" + (label === p ? " on" : "")} onClick={() => setLabel(p)}>{p}</span>)}
        </div>
        <div className="row">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
          <input style={{ width: 80 }} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$" />
          <input style={{ width: 70 }} inputMode="numeric" value={hole} onChange={(e) => setHole(e.target.value)} placeholder="Hole" />
        </div>
        <div style={{ marginTop: ".6rem" }}><button disabled={locked} onClick={addBet}>Add side bet</button></div>
      </div>
      {round.sideBets.map((b) => (
        <div key={b.id} className="card">
          <div className="row between">
            <div><b>{b.label}</b> <span className="muted">{money(b.amount)}{b.hole ? ` · hole ${b.hole}` : ""}</span></div>
            <button className="danger sm" disabled={locked} onClick={() => upd((r) => ({ ...r, sideBets: r.sideBets.filter((x) => x.id !== b.id) }))}>Remove</button>
          </div>
          <div className="row wrapx" style={{ marginTop: ".4rem" }}>
            {ctxPlayers.map((p) => (
              <span key={p.id} className={"chip" + (b.winnerId === p.id ? " on" : "")} onClick={() => !locked && upd((r) => ({ ...r, sideBets: r.sideBets.map((x) => (x.id === b.id ? { ...x, winnerId: x.winnerId === p.id ? null : p.id } : x)) }))}>{p.name}</span>
            ))}
          </div>
        </div>
      ))}

      <h2>Games in this round</h2>
      {round.games.map((g) => (
        <GameEditor key={g.id} game={g} players={round.players} onChange={(ng) => upd((r) => ({ ...r, games: r.games.map((x) => (x.id === g.id ? ng : x)) }))} onRemove={() => upd((r) => ({ ...r, games: r.games.filter((x) => x.id !== g.id) }))} />
      ))}
      <div className="card">
        <div className="muted small" style={{ marginBottom: ".4rem" }}>Add another game any time. It scores holes already played.</div>
        <div className="row wrapx">
          {(Object.keys(GAME_INFO) as GameType[]).map((t) => (
            <button key={t} className="ghost sm" disabled={locked} onClick={() => upd((r) => ({ ...r, games: [...r.games, newGame(t, r.players)] }))}>+ {GAME_INFO[t].name}</button>
          ))}
        </div>
      </div>
    </>
  );
}
