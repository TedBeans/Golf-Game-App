"use client";
import type { Element, Game, MatchGame, RoundPlayer } from "@/lib/types";
import { SCORING, fixedParts, fixedSegments, sixSegments } from "@/lib/catalog";
import { range } from "@/lib/engine/ctx";
import { uid } from "@/lib/id";
import { Field, NumInput, Picker, Seg } from "./ui";

type Props = { game: Game; players: RoundPlayer[]; holes: 9 | 18; onChange: (g: Game) => void; onRemove: () => void };

function PlayerChips({ ids, players, onChange }: { ids: string[]; players: RoundPlayer[]; onChange: (ids: string[]) => void }) {
  const sel = ids.length ? ids : players.map((p) => p.id);
  const toggle = (id: string) => {
    const s = new Set(sel);
    if (s.has(id)) { if (s.size > 2) s.delete(id); } else s.add(id);
    const next = players.map((p) => p.id).filter((x) => s.has(x));
    onChange(next.length === players.length ? [] : next);
  };
  return (
    <div className="row wrap">
      {players.map((p) => <button key={p.id} className={"chip" + (sel.includes(p.id) ? " on" : "")} onClick={() => toggle(p.id)}>{p.name}</button>)}
    </div>
  );
}

function HolesPicker({ value, total, onChange }: { value: number[]; total: number; onChange: (h: number[]) => void }) {
  const all = range(total);
  const key = value.length === total ? "all" : value.length === 9 && value[0] === 0 && value[8] === 8 ? "front" : value.length === 9 && value[0] === 9 ? "back" : "custom";
  const opts = [{ value: "all", label: `All ${total}` }, ...(total === 18 ? [{ value: "front", label: "Front 9" }, { value: "back", label: "Back 9" }] : []), { value: "custom", label: "Pick" }];
  return (
    <div className="stack8">
      <Seg value={key} options={opts} onChange={(k) => onChange(k === "all" ? all : k === "front" ? range(9) : k === "back" ? range(9).map((i) => i + 9) : value)} />
      {key === "custom" && (
        <div className="row wrap" style={{ gap: 6 }}>
          {all.map((h) => (
            <button key={h} className={"chip sm" + (value.includes(h) ? " on" : "")} style={{ width: 38 }} onClick={() => onChange(value.includes(h) ? value.filter((x) => x !== h) : [...value, h].sort((a, b) => a - b))}>{h + 1}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function sameElements(a: Element[], b: Element[]) {
  return a.length === b.length && a.every((e, i) => e.kind === b[i].kind && e.method === b[i].method && e.points === b[i].points);
}

function MatchEditor({ g, players, holes, set }: { g: MatchGame; players: RoundPlayer[]; holes: 9 | 18; set: (g: MatchGame) => void }) {
  const fp = fixedParts(g);
  const side = (id: string) => (g.teamA.includes(id) ? "a" : g.teamB.includes(id) ? "b" : "");
  const cycle = (id: string) => {
    const s = side(id);
    const A = g.teamA.filter((x) => x !== id), B = g.teamB.filter((x) => x !== id);
    if (s === "") A.push(id); else if (s === "a") B.push(id);
    set({ ...g, teamA: A, teamB: B });
  };
  const move = (id: string, d: -1 | 1) => {
    const i = g.order.indexOf(id), j = i + d;
    if (j < 0 || j >= g.order.length) return;
    const o = [...g.order]; [o[i], o[j]] = [o[j], o[i]];
    set({ ...g, order: o });
  };
  const nm = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  const segLen = g.segments[0] ? g.segments[0].to - g.segments[0].from : 6;
  const setEl = (id: string, patch: Partial<Element>) => set({ ...g, elements: g.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const pairs = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]];

  return (
    <>
      <Field label="Format">
        <Seg value={g.format} options={[{ value: "rotate", label: "Rotating partners" }, { value: "fixed", label: "Fixed teams" }]}
          onChange={(f) => f === "rotate"
            ? set({ ...g, format: "rotate", order: g.order.length === 4 ? g.order : players.slice(0, 4).map((p) => p.id), segments: sixSegments(holes, 6) })
            : set({ ...g, format: "fixed", teamA: g.teamA.length ? g.teamA : players.slice(0, 2).map((p) => p.id), teamB: g.teamB.length ? g.teamB : players.slice(2, 4).map((p) => p.id), segments: g.segments.length && g.format === "fixed" ? g.segments : fixedSegments(holes, { front: true, back: true, overall: true }) })} />
      </Field>

      {g.format === "rotate" ? (
        <>
          <Field label="Partner order">
            <div className="row wrap">
              {g.order.map((id, i) => (
                <span key={id} className="row" style={{ gap: 2 }}>
                  <button className="chip" onClick={() => move(id, -1)} disabled={i === 0} style={{ opacity: i === 0 ? 0.5 : 1 }}>{i + 1}. {nm(id)}</button>
                </span>
              ))}
            </div>
            <div className="small faint" style={{ marginTop: 6 }}>Tap a name to move them up the order.</div>
            {g.order.length === 4 && (
              <div className="small sub" style={{ marginTop: 8 }}>
                {g.segments.map((s, i) => { const p = pairs[i % 3]; return <div key={s.id}>{s.label}: {nm(g.order[p[0]])} &amp; {nm(g.order[p[1]])} vs {nm(g.order[p[2]])} &amp; {nm(g.order[p[3]])}</div>; })}
              </div>
            )}
          </Field>
          <Field label="Holes per partner">
            <Seg value={String(segLen)} options={[{ value: "3", label: "3" }, { value: "6", label: "6" }, { value: "9", label: "9" }]} onChange={(v) => set({ ...g, segments: sixSegments(holes, parseInt(v, 10)) })} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Teams (tap to cycle: Team A, Team B, out)">
            <div className="row wrap">
              {players.map((p) => <button key={p.id} className={"chip " + side(p.id)} onClick={() => cycle(p.id)}>{p.name}{side(p.id) ? ` · ${side(p.id).toUpperCase()}` : ""}</button>)}
            </div>
          </Field>
          <Field label="Matches">
            <div className="row wrap">
              {([["front", "Front 9"], ["back", "Back 9"], ["overall", "Overall"], ["whole", "Whole round"]] as const).map(([k, l]) => {
                if ((k === "back" || k === "overall") && holes === 9) return null;
                return <button key={k} className={"chip" + (fp[k] ? " on" : "")} onClick={() => set({ ...g, segments: fixedSegments(holes, { ...fp, [k]: !fp[k] }) })}>{l}</button>;
              })}
            </div>
          </Field>
        </>
      )}

      <Field label="Scoring (net, handicaps included)">
        <div className="row wrap" style={{ marginBottom: 10 }}>
          {SCORING.map((s) => (
            <button key={s.key} className={"chip" + (sameElements(g.elements, s.elements()) ? " on" : "")} onClick={() => set({ ...g, elements: s.elements() })}>{s.label}</button>
          ))}
        </div>
        <div className="stack8">
          {g.elements.map((e) => (
            <div key={e.id} className="elrow">
              <div className="row" style={{ gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}><Picker title="Scoring" value={e.kind} onChange={(v) => setEl(e.id, { kind: v as Element["kind"] })} options={[{ value: "bestBall", label: "Best ball", sub: "Lower of the two partners' net scores" }, { value: "combined", label: "Combined", sub: "Both partners' net scores added" }]} /></div>
                <div style={{ flex: 1, minWidth: 0 }}><Picker title="Counted by" value={e.method} onChange={(v) => setEl(e.id, { method: v as Element["method"] })} options={[{ value: "total", label: "Total score", sub: "Lowest total over the segment wins" }, { value: "holes", label: "Holes won", sub: "Most holes won takes the point" }]} /></div>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <span className="small faint">Worth</span>
                <div style={{ width: 64 }}><NumInput className="num" value={e.points} min={0} onChange={(n) => setEl(e.id, { points: n })} /></div>
                <span className="small faint grow">{e.points === 1 ? "point" : "points"}</span>
                <button className="btn quiet sm" aria-label="Remove element" onClick={() => set({ ...g, elements: g.elements.filter((x) => x.id !== e.id) })}>Remove</button>
              </div>
            </div>
          ))}
          <button className="btn ghost sm" onClick={() => set({ ...g, elements: [...g.elements, { id: uid(), kind: "bestBall", method: "total", points: 1 }] })}>+ Add scoring element</button>
          <div className="small faint">Each element is worth the points you set. Win it to take them, a tie {g.ties === "carry" ? "carries its points into the next segment." : "pushes."}</div>
        </div>
      </Field>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="grow"><Field label="$ per point, per player"><NumInput prefix="$" value={g.stake} min={0} onChange={(n) => set({ ...g, stake: n })} /></Field></div>
        <div className="grow"><Field label="Ties"><Seg value={g.ties} options={[{ value: "push", label: "Push" }, { value: "carry", label: "Carry over" }]} onChange={(t) => set({ ...g, ties: t, maxCarry: t === "carry" ? g.maxCarry ?? 2 : g.maxCarry })} /></Field></div>
      </div>
      {g.ties === "carry" && (
        <Field label="Max carry-over">
          <Picker title="Max carry-over" value={String(g.maxCarry ?? 0)} onChange={(v) => set({ ...g, maxCarry: Number(v) })} options={[
            { value: "2", label: "Double", meta: "2×", sub: "A tie carries once" },
            { value: "3", label: "Triple", meta: "3×", sub: "Up to two ties in a row" },
            { value: "4", label: "Quadruple", meta: "4×", sub: "Up to three ties in a row" },
            { value: "0", label: "No limit", meta: "∞", sub: "Keeps stacking until someone wins" },
          ]} />
        </Field>
      )}
    </>
  );
}

export default function GameEditor({ game: g, players, holes, onChange, onRemove }: Props) {
  const set = (x: Game) => onChange(x);
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <input className="input" style={{ fontWeight: 800, fontSize: 18, background: "transparent", border: 0, padding: "2px 0", letterSpacing: "-.01em" }} value={g.name} onChange={(e) => set({ ...g, name: e.target.value })} aria-label="Game name" />
        <button className="btn quiet sm" onClick={onRemove}>Remove</button>
      </div>

      {g.type === "match" && <MatchEditor g={g} players={players} holes={holes} set={set} />}

      {(g.type === "skins" || g.type === "stroke" || g.type === "stableford" || g.type === "wolf" || g.type === "bingo") && (
        <>
          <Field label="Who's in"><PlayerChips ids={g.playerIds} players={players} onChange={(ids) => set({ ...g, playerIds: ids })} /></Field>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="grow"><Field label={g.type === "stroke" ? "$ buy-in" : g.type === "skins" ? "$ per skin, from each player" : "$ per point"}><NumInput prefix="$" value={g.stake} min={0} onChange={(n) => set({ ...g, stake: n })} /></Field></div>
            {g.type === "skins" && (
              <div className="grow"><Field label="Ties"><Seg value={g.carryover ? "c" : "n"} options={[{ value: "c", label: "Carry" }, { value: "n", label: "No skin" }]} onChange={(v) => set({ ...g, carryover: v === "c" })} /></Field></div>
            )}
          </div>
        </>
      )}

      {g.type === "wolf" && (
        <Field label="Points">
          <div className="row" style={{ gap: 8 }}>
            {([["teamPts", "Team win"], ["lonePts", "Lone win"], ["packPts", "Pack beats lone"], ["blindMult", "Blind ×"]] as const).map(([k, l]) => (
              <div key={k} className="grow"><div className="small faint" style={{ marginBottom: 4 }}>{l}</div><NumInput className="num" value={g[k]} min={0} onChange={(n) => set({ ...g, [k]: n })} /></div>
            ))}
          </div>
        </Field>
      )}

      {g.type === "vegas" && (
        <>
          {(["teamA", "teamB"] as const).map((k) => (
            <Field key={k} label={k === "teamA" ? "Team A" : "Team B"}>
              <div className="row">
                {[0, 1].map((i) => (
                  <Picker key={i} title="Pick player" placeholder="Pick" value={g[k][i] ?? ""} onChange={(v) => { const t = [...g[k]]; t[i] = v; set({ ...g, [k]: t.filter(Boolean) }); }} options={players.map((p) => ({ value: p.id, label: p.name }))} />
                ))}
              </div>
            </Field>
          ))}
          <Field label="$ per point, per player"><NumInput prefix="$" value={g.stake} min={0} onChange={(n) => set({ ...g, stake: n })} /></Field>
        </>
      )}

      {g.type !== "match" && (
        <Field label="Holes this game counts"><HolesPicker value={g.holes} total={holes} onChange={(h) => set({ ...g, holes: h })} /></Field>
      )}
    </div>
  );
}
