import type { Transfer } from "./types";

export const cents = (n: number) => Math.round(n * 100) / 100;
export const money = (n: number) => {
  const v = cents(n);
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  return `${v < 0 ? "-" : ""}$${s}`;
};
export const signed = (n: number) => (cents(n) > 0 ? `+${money(n)}` : money(n));

/** Collapse balances (+ owed / - owes) into the fewest payments. */
export function settle(balances: Record<string, number>): Transfer[] {
  const cr: { id: string; amt: number }[] = [];
  const dr: { id: string; amt: number }[] = [];
  for (const [id, b] of Object.entries(balances)) {
    const v = cents(b);
    if (v > 0.004) cr.push({ id, amt: v });
    else if (v < -0.004) dr.push({ id, amt: -v });
  }
  cr.sort((a, b) => b.amt - a.amt);
  dr.sort((a, b) => b.amt - a.amt);
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < cr.length && j < dr.length) {
    const pay = cents(Math.min(cr[i].amt, dr[j].amt));
    if (pay > 0) out.push({ from: dr[j].id, to: cr[i].id, amount: pay });
    cr[i].amt = cents(cr[i].amt - pay);
    dr[j].amt = cents(dr[j].amt - pay);
    if (cr[i].amt <= 0.004) i++;
    if (dr[j].amt <= 0.004) j++;
  }
  return out;
}
