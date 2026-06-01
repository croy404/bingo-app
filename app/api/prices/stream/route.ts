import { cacheGet } from "@/lib/redis";
export const dynamic = "force-dynamic";

// SSE endpoint — streams Redis-cached prices every 3s for requested symbols.
// Symbols format: EXCHANGE:SYMBOL,... e.g. NSE:RELIANCE,BSE:TCS
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").filter((s) => s.includes(":"));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const push = async () => {
        if (closed) return;
        const prices: Record<string, unknown> = {};
        for (const sym of symbols) {
          const [exchange, symbol] = sym.split(":");
          const cached = await cacheGet(`price:${exchange}:${symbol}`);
          if (cached) prices[sym] = cached;
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(prices)}\n\n`));
        } catch {
          closed = true;
        }
      };

      await push();
      const interval = setInterval(push, 3000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
