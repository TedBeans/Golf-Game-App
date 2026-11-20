import type { Round } from "./types";
import { computeRound } from "./engine";
import { money, signed } from "./money";

export function recapText(round: Round): string {
  const { results, net, transfers } = computeRound(round);
  const name = (id: string) => round.players.find((p) => p.id === id)?.name ?? "?";
  const out = [`${round.course.name} · ${round.date}`, ""];
  for (const r of results) out.push(`${r.title}: ${r.status}`);
  out.push("", "Totals");
  for (const [id, v] of Object.entries(net).sort((a, b) => b[1] - a[1])) out.push(`${name(id)} ${signed(v)}`);
  out.push("", "Who pays who");
  if (!transfers.length) out.push("All square");
  for (const t of transfers) out.push(`${name(t.from)} pays ${name(t.to)} ${money(t.amount)}`);
  return out.join("\n");
}
