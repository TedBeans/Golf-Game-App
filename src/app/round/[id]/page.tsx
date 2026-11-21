"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/id";
import type { Round, SideBet } from "@/lib/types";
import { computeRound } from "@/lib/engine";
import { wolfOrder } from "@/lib/engine/games";
import { makeCtx } from "@/lib/engine/ctx";
import { playingHandicaps, totalPar } from "@/lib/handicap";
import { money } from "@/lib/money";
import { recapText } from "@/lib/share";
import { CATALOG, addGame } from "@/lib/catalog";
import GameEditor from "@/components/GameEditor";
import { Avatar, Net, NumInput, Seg, useToast, ConfirmSheet } from "@/components/ui";

type Tab = "hole" | "card" | "money" | "games";
type Upd = (fn: (r: Round) => Round) => void;

export default function RoundPage() {
  const { id } = useParams<{ id: string }>();
  const { state, ready, updateRound } = useStore();
  const round = state.rounds.find((r) => r.id === id);
  const [tab, setTab] = useState<Tab>("hole");
  const [hole, setHole] = useState<number | null>(null);
  const computed = useMemo(() => (round ? computeRound(round) : null), [round]);
  if (!ready) return <div className="empty">Loading…</div>;
  if (!round || !computed) return <div className="empty">Round not found. <Link href="/" className="gain">Home</Link></div>;

  const upd: Upd = (fn) => updateRound(round.id, fn);
  const firstOpen = Math.max(0, Array.from({ length: round.holes }, (_, h) => h).find((h) => round.players.some((p) => typeof round.scores[p.id]?.[h] !== "number")) ?? round.holes - 1);
  const cur = hole ?? firstOpen;
  const ph = playingHandicaps(round);
  const locked = round.status === "final";

  return (
    <>
      <div className="top">
        <Link href="/" className="btn quiet sm">← Home</Link>
        <span className="small faint">{round.demo ? "Demo round" : round.status === "final" ? "Final" : round.date}</span>
      </div>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div><h1 className="title" style={{ fontSize: 24 }}>{round.course.name || "Round"}</h1><div className="small faint">{round.course.tee ? `${round.course.tee} tees · ` : ""}Par {totalPar(round.course.pars, round.holes)} · {round.holes} holes</div></div>
      </div>

      <div className="strip" style={{ marginBottom: 14 }}>
        {round.players.map((p) => (
          <div key={p.id} className="tot">
            <div className="n">{p.name}{ph[p.id] ? ` · ${ph[p.id]} stk` : ""}</div>
            <div className="v"><Net v={computed.net[p.id] ?? 0} /></div>
          </div>
        ))}
      </div>

      <Seg<Tab> value={tab} onChange={setTab} options={[{ value: "hole", label: "Hole" }, { value: "card", label: "Card" }, { value: "money", label: "Money" }, { value: "games", label: "Games" }]} />
      <div style={{ height: 16 }} />

      {tab === "hole" && <HoleTab round={round} hole={cur} setHole={setHole} upd={upd} locked={locked} computed={computed} goMoney={() => setTab("money")} />}
      {tab === "card" && <CardTab round={round} setHole={(h) => { setHole(h); setTab("hole"); }} />}
      {tab === "money" && <MoneyTab round={round} computed={computed} upd={upd} />}
      {tab === "games" && <GamesTab round={round} upd={upd} locked={locked} />}
    </>
  );
}

function HoleTab({ round, hole, setHole, upd, locked, computed, goMoney }: { round: Round; hole: number; setHole: (h: number) => void; upd: Upd; locked: boolean; computed: ReturnType<typeof computeRound>; goMoney: () => void }) {
  const c = makeCtx(round);
  const par = round.course.pars[hole];
  const yds = round.course.yards?.[hole];
  const set = (pid: string, v: number | null) => upd((r) => ({ ...r, scores: { ...r.scores, [pid]: (r.scores[pid] ?? Array(r.holes).fill(null)).map((x, i) => (i === hole ? v : x)) } }));
  const done = (h: number) => round.players.every((p) => typeof round.scores[p.id]?.[h] === "number");
  const allIn = done(hole);
  const last = hole === round.holes - 1;

  return (
    <div className="stack">
      <div className="holes">
        {Array.from({ length: round.holes }, (_, h) => <button key={h} className={(hole === h ? "on " : "") + (done(h) ? "done" : "")} onClick={() => setHole(h)}>{h + 1}</button>)}
      </div>

      <div className="card">
        <div className="holehead">
          <div className="holenum"><small>HOLE</small>{hole + 1}</div>
          <div className="facts"><div><b>{par}</b><span>PAR</span></div>{yds ? <div><b>{yds}</b><span>YDS</span></div> : null}<div><b>{round.course.strokeIndex[hole]}</b><span>HDCP</span></div></div>
        </div>
        <div style={{ marginTop: 8 }}>
          {round.players.map((p) => {
            const s = round.scores[p.id]?.[hole] ?? null;
            const k = c.strokes(p.id, hole);
            return (
              <div key={p.id} className="prow">
                <Avatar name={p.name} />
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div className="small faint">{k > 0 ? <><span className="dots">{"●".repeat(Math.min(k, 3))}</span> gets {k} stroke{k > 1 ? "s" : ""}</> : k < 0 ? "gives a stroke" : "no strokes"}{s !== null && k !== 0 ? ` · net ${s - k}` : ""}</div>
                </div>
                <div className="stepper">
                  <button disabled={locked} onClick={() => set(p.id, s === null ? par : Math.max(1, s - 1))} aria-label={`${p.name} minus`}>−</button>
                  <div className={"val" + (s === null ? " nil" : "")}>{s ?? "–"}</div>
                  <button disabled={locked} onClick={() => set(p.id, s === null ? par : Math.min(15, s + 1))} aria-label={`${p.name} plus`}>+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn ghost sm" disabled={locked} onClick={() => round.players.forEach((p) => set(p.id, par))}>Everyone made par</button>
          <button className="btn quiet sm" disabled={locked} onClick={() => round.players.forEach((p) => set(p.id, null))}>Clear hole</button>
        </div>
      </div>

      {allIn && (
        <button className="btn accent block" onClick={() => (last ? goMoney() : setHole(hole + 1))}>{last ? "See the money" : `Next hole  →`}</button>
      )}

      {round.games.filter((g) => g.type === "wolf").map((g) => {
        if (g.type !== "wolf") return null;
        const order = wolfOrder(round, g);
        const wolfId = order[hole % order.length];
        const cur = round.wolf?.[g.id]?.[hole]?.choice;
        const setPick = (choice: string | null) => upd((r) => { const a = [...(r.wolf?.[g.id] ?? Array(r.holes).fill(null))]; a[hole] = choice ? { choice } : null; return { ...r, wolf: { ...r.wolf, [g.id]: a } }; });
        return (
          <div key={g.id} className="card">
            <div className="label">{g.name}</div>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>{c.name(wolfId)} is the wolf</div>
            <div className="row wrap">
              {order.filter((x) => x !== wolfId).map((id) => <button key={id} className={"chip" + (cur === id ? " on" : "")} disabled={locked} onClick={() => setPick(cur === id ? null : id)}>With {c.name(id)}</button>)}
              <button className={"chip" + (cur === "lone" ? " on" : "")} disabled={locked} onClick={() => setPick(cur === "lone" ? null : "lone")}>Lone wolf</button>
              <button className={"chip" + (cur === "blind" ? " on" : "")} disabled={locked} onClick={() => setPick(cur === "blind" ? null : "blind")}>Blind wolf</button>
            </div>
            {!cur && <div className="warn" style={{ marginTop: 8 }}>No pick yet. This hole won't count for Wolf.</div>}
          </div>
        );
      })}

      {round.games.filter((g) => g.type === "bingo").map((g) => {
        if (g.type !== "bingo") return null;
        const ids = g.playerIds.length ? g.playerIds : round.players.map((p) => p.id);
        const cur = round.bingo?.[g.id]?.[hole] ?? {};
        const setK = (k: "bingo" | "bango" | "bongo", v: string) => upd((r) => { const a = [...(r.bingo?.[g.id] ?? Array(r.holes).fill(null))]; a[hole] = { ...(a[hole] ?? {}), [k]: v || undefined }; return { ...r, bingo: { ...r.bingo, [g.id]: a } }; });
        return (
          <div key={g.id} className="card stack8">
            <div className="label">{g.name}</div>
            {([["bingo", "First on the green"], ["bango", "Closest once all are on"], ["bongo", "First in the hole"]] as const).map(([k, l]) => (
              <div key={k} className="row"><span className="sub small" style={{ width: 150 }}>{l}</span>
                <select className="input" disabled={locked} value={cur[k] ?? ""} onChange={(e) => setK(k, e.target.value)}><option value="">–</option>{ids.map((id) => <option key={id} value={id}>{c.name(id)}</option>)}</select></div>
            ))}
          </div>
        );
      })}

      {computed.results.length > 0 && (
        <div className="card">
          <div className="label">Live</div>
          <div className="divide">
            {computed.results.map((r) => (
              <div key={r.gameId} style={{ padding: "10px 0" }}><div className="row between"><b>{r.title}</b>{r.warnings?.length ? <span className="warn">Check setup</span> : null}</div><div className="small sub">{r.status}</div></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CardTab({ round, setHole }: { round: Round; setHole: (h: number) => void }) {
  const c = makeCtx(round);
  const cls = (g: number, par: number) => { const d = g - par; return d <= -1 ? "sc under" : d === 1 ? "sc over" : d >= 2 ? "sc dbl" : "sc"; };
  const sum = (pid: string, from: number, to: number, net = false) => { let t = 0, n = 0; for (let h = from; h < to; h++) { const v = net ? c.net(pid, h) : c.gross(pid, h); if (v !== null) { t += v; n++; } } return n ? t : "–"; };
  const hs = Array.from({ length: round.holes }, (_, h) => h);
  const parSum = (a: number, b: number) => round.course.pars.slice(a, b).reduce((x, y) => x + y, 0);
  const wins = computeRound(round).results.filter((r) => r.holeWins?.length);
  return (
    <div className="stack">
    <div className="card scroll" style={{ padding: 8 }}>
      <table className="tbl card-t">
        <thead><tr><th>Hole</th>{hs.map((h) => <th key={h}><button onClick={() => setHole(h)} className="btn quiet" style={{ padding: 0, color: "inherit", font: "inherit" }}>{h + 1}</button></th>)}{round.holes === 18 && <><th>OUT</th><th>IN</th></>}<th>TOT</th></tr>
          <tr><th>Par</th>{hs.map((h) => <th key={h} style={{ color: "var(--dim)" }}>{round.course.pars[h]}</th>)}{round.holes === 18 && <><th>{parSum(0, 9)}</th><th>{parSum(9, 18)}</th></>}<th>{parSum(0, round.holes)}</th></tr></thead>
        <tbody>
          {round.players.map((p) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 700 }}>{p.name}</td>
              {hs.map((h) => { const g = c.gross(p.id, h); return <td key={h} className={c.strokes(p.id, h) > 0 ? "stk" : ""}>{g === null ? <span className="faint">·</span> : <span className={cls(g, c.par(h))}>{g}</span>}</td>; })}
              {round.holes === 18 && <><td><b>{sum(p.id, 0, 9)}</b></td><td><b>{sum(p.id, 9, 18)}</b></td></>}
              <td><b>{sum(p.id, 0, round.holes)}</b></td>
            </tr>
          ))}
          {round.players.map((p) => (
            <tr key={"n" + p.id} className="tot">
              <td style={{ color: "var(--accent)" }}>{p.name} net</td>
              {hs.map((h) => <td key={h} className="faint" style={{ fontWeight: 600 }}>{c.net(p.id, h) ?? ""}</td>)}
              {round.holes === 18 && <><td>{sum(p.id, 0, 9, true)}</td><td>{sum(p.id, 9, 18, true)}</td></>}
              <td>{sum(p.id, 0, round.holes, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small faint" style={{ padding: "8px 8px 2px" }}>Dot = gets a stroke on that hole. Circle = under par, box = over.</div>
    </div>
    {wins.map((r) => (
      <div key={r.gameId} className="card hw">
        <div className="h2" style={{ margin: "0 0 2px" }}>{r.title}</div>
        <div className="small sub" style={{ marginBottom: 10 }}>Who won each point, hole by hole (net)</div>
        {r.holeWins!.map((seg) => {
          const tally = { A: 0, B: 0 };
          seg.rows.forEach((row) => row.items.forEach((it) => { if (it.winner !== "tie") tally[it.winner]++; }));
          return (
            <div key={seg.segment} className="hw-seg">
              <div className="hw-head">
                <div><b>{seg.segment}</b><div className="small sub"><span className="hwA">{seg.teams[0]}</span> vs <span className="hwB">{seg.teams[1]}</span></div></div>
                <div className="hw-tally"><span className="hwA">{tally.A}</span><span className="faint"> – </span><span className="hwB">{tally.B}</span></div>
              </div>
              <div className="hw-row hw-cols"><span>Hole</span>{seg.rows[0].items.map((it) => <span key={it.label}>{it.label}</span>)}</div>
              {seg.rows.map((row) => (
                <div key={row.hole} className="hw-row">
                  <span className="hw-h">{row.hole + 1}</span>
                  {row.items.map((it) => (
                    <span key={it.label} className={it.winner === "A" ? "hwA" : it.winner === "B" ? "hwB" : "hwT"}>
                      {it.winner === "tie" ? "Tie" : it.winner === "A" ? seg.teams[0] : seg.teams[1]}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    ))}
    </div>
  );
}

function MoneyTab({ round, computed, upd }: { round: Round; computed: ReturnType<typeof computeRound>; upd: Upd }) {
  const router = useRouter();
  const { deleteRound } = useStore();
  const [delOpen, setDelOpen] = useState(false);
  const toast = useToast();
  const name = (id: string) => round.players.find((p) => p.id === id)?.name ?? "?";
  const copy = async () => { try { await navigator.clipboard.writeText(recapText(round)); toast.show("Recap copied"); } catch { toast.show("Couldn't copy"); } };
  const share = async () => { const text = recapText(round); if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* cancelled */ } } copy(); };
  const nobody = computed.transfers.length === 0;
  return (
    <div className="stack">
      <div className="card">
        <div className="label">Who pays who</div>
        {nobody ? <div className="sub" style={{ padding: "8px 0" }}>Nothing owed yet. Money lands as segments and holes finish.</div> : computed.transfers.map((t, i) => (
          <div key={i} className="owe"><div><b>{name(t.from)}</b> <span className="sub">pays</span> <b>{name(t.to)}</b></div><div className="amt">{money(t.amount)}</div></div>
        ))}
      </div>

      <div className="card divide" style={{ padding: "4px 16px" }}>
        {[...round.players].sort((a, b) => (computed.net[b.id] ?? 0) - (computed.net[a.id] ?? 0)).map((p) => (
          <div key={p.id} className="prow"><Avatar name={p.name} /><div className="grow" style={{ fontWeight: 700 }}>{p.name}</div><Net v={computed.net[p.id] ?? 0} className="big" /></div>
        ))}
      </div>

      <div className="h2" style={{ margin: "10px 0 0" }}>By game</div>
      {computed.results.map((r) => (
        <details key={r.gameId} className="card acc">
          <summary>
            <div className="row between"><div><b>{r.title}</b>{r.subtitle && <div className="small faint">{r.subtitle}</div>}</div><span className="small faint">▾</span></div>
            <div className="small sub" style={{ marginTop: 6 }}>{r.status}</div>
          </summary>
          <div style={{ marginTop: 12 }}>
            {r.warnings?.map((w, i) => <div key={i} className="warn" style={{ marginBottom: 8 }}>{w}</div>)}
            <div className="row wrap small" style={{ gap: 14, marginBottom: 8 }}>{Object.entries(r.net).filter(([id]) => round.players.some((p) => p.id === id)).map(([id, v]) => <span key={id}><span className="sub">{name(id)}</span> <Net v={v} /></span>)}</div>
            {r.table && r.table.rows.length > 0 && (
              <div className="scroll"><table className="tbl"><thead><tr>{r.table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{r.table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>
            )}
            {r.gameId === "side" && r.lines.map((l, i) => <div key={i} className="small sub">{l}</div>)}
          </div>
        </details>
      ))}

      <div className="row wrap">
        <button className="btn ghost grow" onClick={share}>Share recap</button>
        <button className="btn ghost grow" onClick={copy}>Copy results</button>
      </div>
      <div className="row wrap">
        {round.status === "final"
          ? <button className="btn ghost grow" onClick={() => upd((r) => ({ ...r, status: "active" }))}>Reopen round</button>
          : <button className="btn grow" onClick={() => { upd((r) => ({ ...r, status: "final" })); router.push("/ledger"); }}>Finish round</button>}
        <button className="btn danger" onClick={() => setDelOpen(true)}>Delete</button>
      </div>
      {round.demo && <div className="small faint">This is a demo round, so it never counts toward your balances.</div>}
      <ConfirmSheet open={delOpen} title="Delete this round?" body="The round and any money from it will be removed. This can't be undone." onConfirm={() => { deleteRound(round.id); router.push("/"); }} onClose={() => setDelOpen(false)} />
      {toast.node}
    </div>
  );
}

const PRESETS = ["Closest to pin", "Long drive", "Greenie", "Birdie pot"];

function GamesTab({ round, upd, locked }: { round: Round; upd: Upd; locked: boolean }) {
  const [label, setLabel] = useState(PRESETS[0]);
  const [amount, setAmount] = useState<number | undefined>(2);
  const [hole, setHole] = useState<number | undefined>(undefined);
  const addBet = () => { const b: SideBet = { id: uid(), label: label.trim() || "Side bet", amount: amount ?? 0, winnerId: null, hole: hole && hole > 0 ? hole : undefined }; upd((r) => ({ ...r, sideBets: [...r.sideBets, b] })); };
  return (
    <div className="stack">
      {round.games.map((g) => (
        <GameEditor key={g.id} game={g} players={round.players} holes={round.holes} onChange={(ng) => upd((r) => ({ ...r, games: r.games.map((x) => (x.id === g.id ? ng : x)) }))} onRemove={() => upd((r) => ({ ...r, games: r.games.filter((x) => x.id !== g.id) }))} />
      ))}

      <div>
        <div className="h2" style={{ marginTop: 6 }}>Add a game</div>
        <div className="card divide" style={{ padding: "4px 16px" }}>
          {CATALOG.map((c) => (
            <button key={c.key} className="catalog" disabled={locked} onClick={() => upd((r) => ({ ...r, games: [...r.games, addGame(c, { players: r.players, holes: r.holes }, r.games)] }))}>
              <span className="plus">+</span><div className="grow"><div style={{ fontWeight: 700 }}>{c.title} <span className="faint small"> · {c.meta}</span></div><div className="small sub">{c.blurb}</div></div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="h2" style={{ marginTop: 6 }}>Side bets</div>
        <div className="card">
          <div className="small sub" style={{ marginBottom: 10 }}>One per contest. The winner collects the amount from every other player.</div>
          <div className="row wrap" style={{ marginBottom: 10 }}>{PRESETS.map((p) => <button key={p} className={"chip" + (label === p ? " on" : "")} onClick={() => setLabel(p)}>{p}</button>)}</div>
          <div className="row">
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
            <div style={{ width: 86 }}><NumInput prefix="$" value={amount} min={0} onChange={setAmount} /></div>
            <div style={{ width: 70 }}><NumInput className="num" value={hole} min={1} max={round.holes} placeholder="Hole" onChange={setHole} /></div>
          </div>
          <button className="btn ghost block" style={{ marginTop: 10 }} disabled={locked} onClick={addBet}>Add side bet</button>
        </div>
        {round.sideBets.map((b) => (
          <div key={b.id} className="card" style={{ marginTop: 10 }}>
            <div className="row between"><div><b>{b.label}</b> <span className="sub small">{money(b.amount)}{b.hole ? ` · hole ${b.hole}` : ""}</span></div>
              <button className="btn quiet sm" onClick={() => upd((r) => ({ ...r, sideBets: r.sideBets.filter((x) => x.id !== b.id) }))}>Remove</button></div>
            <div className="row wrap" style={{ marginTop: 10 }}>
              {round.players.map((p) => <button key={p.id} className={"chip" + (b.winnerId === p.id ? " on" : "")} disabled={locked} onClick={() => upd((r) => ({ ...r, sideBets: r.sideBets.map((x) => (x.id === b.id ? { ...x, winnerId: x.winnerId === p.id ? null : p.id } : x)) }))}>{p.name}</button>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
