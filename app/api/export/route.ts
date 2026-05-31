import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}

export async function GET(req: Request) {
  const type = new URL(req.url).searchParams.get("type") ?? "portfolio";
  let rows: Record<string, unknown>[] = [];
  if (type === "portfolio") {
    rows = (await prisma.portfolio.findMany({ orderBy: { symbol: "asc" } })).map(r => ({
      symbol: r.symbol, exchange: r.exchange, sector: r.sector, qty: r.qty, avg_price: r.avgPrice,
      buy_date: r.buyDate?.toISOString().slice(0, 10) ?? "", notes: r.notes ?? "",
    }));
  } else if (type === "journal") {
    rows = (await prisma.journal.findMany({ orderBy: { tradeDate: "desc" } })).map(r => ({
      date: r.tradeDate.toISOString().slice(0, 10), symbol: r.symbol, direction: r.direction,
      qty: r.qty, entry: r.entryPrice, exit: r.exitPrice ?? "", pnl: r.pnl ?? "",
      setup: r.setup ?? "", emotion: r.emotion ?? "", notes: r.notes ?? "",
    }));
  } else if (type === "intraday") {
    rows = (await prisma.intradayTrade.findMany({ orderBy: { tradeDate: "desc" } })).map(r => ({
      date: r.tradeDate.toISOString().slice(0, 10), symbol: r.symbol, side: r.side, qty: r.qty, price: r.price,
    }));
  } else if (type === "alerts") {
    rows = (await prisma.alert.findMany({ orderBy: { createdAt: "desc" } })).map(r => ({
      symbol: r.symbol, exchange: r.exchange, condition: r.condition, price: r.price,
      type: r.alertType, active: r.isActive, triggered: r.triggeredCount,
    }));
  }
  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="bingo-${type}-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
}
