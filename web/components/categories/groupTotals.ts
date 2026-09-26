import type { GroupRow } from "@/lib/queries/categoriesPage";

export type GroupTotal = { productGroup: string; salesTy: number; salesLy: number | null };

/** Product group totals, folding together the three groups that appear
 * under two major groups (Softshell, Gilets & Bodywarmers, Socks). */
export function groupTotals(rows: GroupRow[]): GroupTotal[] {
  const map = new Map<string, GroupTotal>();
  for (const r of rows) {
    const g = map.get(r.productGroup) ?? { productGroup: r.productGroup, salesTy: 0, salesLy: r.salesLy === null ? null : 0 };
    g.salesTy += r.salesTy;
    if (g.salesLy !== null && r.salesLy !== null) g.salesLy += r.salesLy;
    map.set(r.productGroup, g);
  }
  return Array.from(map.values()).sort((a, b) => b.salesTy - a.salesTy);
}