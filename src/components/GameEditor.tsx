"use client";
import type { GameConfig, GameType, Player } from "@/lib/types";
import { GAME_INFO } from "@/lib/games";
import { uid } from "@/lib/store";

export function newGame(type: GameType, players: Player[]): GameConfig {
  const info = GAME_INFO[type];
  const g: GameConfig = { id: uid(), type, stake: info.defaultStake, basis: "net", playerIds: [], carryover: true, nassauFront: true, nassauBack: true, nassauOverall: true };
  if (type === "vegas") {
    g.teamA = players.slice(0, 2).map((p) => p.id);
    g.teamB = players.slice(2, 4).map((p) => p.id);
  }
  return g;
}

type Props = { game: GameConfig; players: Player[]; onChange: (g: GameConfig) => void; onRemove: () => void };

export default function GameEditor({ game, players, onChange, onRemove }: Props) {
  const info = GAME_INFO[game.type];
  const part = game.playerIds.length ? game.playerIds : players.map((p) => p.id);
  const toggle = (id: string) => {
    const set = new Set(part);
    set.has(id) ? set.delete(id) : set.add(id);
    const next = players.map((p) => p.id).filter((x) => set.has(x));
    onChange({ ...game, playerIds: next.length === players.length ? [] : next });
  };
  const setTeam = (key: "teamA" | "teamB", slot: 0 | 1, id: string) => {
    const cur = [...(game[key] ?? ["", ""])];
    cur[slot] = id;
    onChange({ ...game, [key]: cur });
  };
  const n = part.length;
  const warn =
    game.type === "wolf" && n < 3 ? "Wolf needs 3-5 players." :
    game.type === "vegas" && players.length < 4 ? "Vegas needs 4 players." : "";

  return (
    <div className="card">
      <div className="row between">
        <h3 style={{ margin: 0 }}>{info.name}</h3>
        <button className="danger sm" onClick={onRemove}>Remove</button>
      </div>
      <div className="muted small">{info.blurb}</div>
      <div className="row wrapx">
        <div style={{ width: 130 }}>
          <label>{info.stakeLabel}</label>
          <input inputMode="decimal" defaultValue={game.stake} onBlur={(e) => onChange({ ...game, stake: Math.max(0, parseFloat(e.target.value) || 0) })} />
        </div>
        {info.supportsBasis && (
          <div style={{ width: 130 }}>
            <label>Scoring</label>
            <select value={game.basis} onChange={(e) => onChange({ ...game, basis: e.target.value as "net" | "gross" })}>
              <option value="net">Net (handicaps)</option>
              <option value="gross">Gross</option>
            </select>
          </div>
        )}
      </div>

      {game.type === "skins" && (
        <label className="row" style={{ marginTop: ".6rem", color: "var(--text)" }}>
          <input type="checkbox" checked={!!game.carryover} onChange={(e) => onChange({ ...game, carryover: e.target.checked })} /> Carry over tied skins
        </label>
      )}
      {game.type === "nassau" && (
        <div className="row wrapx" style={{ marginTop: ".6rem" }}>
          {([["nassauFront", "Front"], ["nassauBack", "Back"], ["nassauOverall", "Overall"]] as const).map(([k, l]) => (
            <span key={k} className={"chip" + (game[k] !== false ? " on" : "")} onClick={() => onChange({ ...game, [k]: game[k] === false })}>{l}</span>
          ))}
        </div>
      )}
      {game.type === "vegas" && (
        <div style={{ marginTop: ".6rem" }}>
          {(["teamA", "teamB"] as const).map((key) => (
            <div key={key} className="row" style={{ marginBottom: ".4rem" }}>
              <span style={{ width: 60 }}>{key === "teamA" ? "Team A" : "Team B"}</span>
              {[0, 1].map((slot) => (
                <select key={slot} value={game[key]?.[slot] ?? ""} onChange={(e) => setTeam(key, slot as 0 | 1, e.target.value)}>
                  <option value="">Pick</option>
                  {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ))}
            </div>
          ))}
        </div>
      )}
      {game.type !== "vegas" && players.length > 2 && (
        <div style={{ marginTop: ".6rem" }}>
          <div className="muted small">Who is in this game</div>
          <div className="row wrapx" style={{ marginTop: ".3rem" }}>
            {players.map((p) => <span key={p.id} className={"chip" + (part.includes(p.id) ? " on" : "")} onClick={() => toggle(p.id)}>{p.name}</span>)}
          </div>
        </div>
      )}
      {warn && <div className="warn" style={{ marginTop: ".5rem" }}>{warn}</div>}
    </div>
  );
}
