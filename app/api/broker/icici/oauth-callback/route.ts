import { generateSession } from "@/lib/broker-icici";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";

function html(body: string): Response {
  return new Response(
    `<html><body style="background:#0f172a;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center">
       <div>${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

/**
 * ICICI redirects here after login with the session token in the query string
 * (?apisession=... or ?API_Session=...). We complete the Breeze session using
 * the saved API key + secret. Register this exact URL as the redirect in the
 * ICICI developer portal (api.icicidirect.com).
 */
async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let token = url.searchParams.get("apisession") || url.searchParams.get("API_Session") || url.searchParams.get("api_session") || "";
  if (!token && req.method === "POST") {
    try { const body = await req.json(); token = body.apisession || body.API_Session || ""; } catch { /* ignore */ }
  }
  if (!token) return html(`<h2 style="color:#f87171">✕ No session token received</h2><p>ICICI did not send an apisession parameter.</p>`);

  const rows = await prisma.setting.findMany({ where: { key: { in: ["icici_api_key", "icici_secret"] } } });
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
  if (!cfg.icici_api_key || !cfg.icici_secret) {
    return html(`<h2 style="color:#f87171">✕ No saved API key/secret</h2><p>Open the Brokers tab, save your ICICI API Key + Secret once, then retry login.</p>`);
  }
  try {
    const s = await generateSession(cfg.icici_api_key, cfg.icici_secret, token.trim());
    return html(`<h2 style="color:#34d399">✅ Connected as ${s.userName}</h2><p>You can close this window — BINGO now has live ICICI data.</p>
      <script>try{window.opener&&window.opener.postMessage({type:'icici_login_complete',user:${JSON.stringify(s.userName)}},'*')}catch(e){}setTimeout(()=>window.close(),2500)</script>`);
  } catch (e) {
    return html(`<h2 style="color:#f87171">✕ Login failed</h2><p>${String(e)}</p><p style="color:#64748b;font-size:13px">Check the Secret matches api.icicidirect.com.</p>`);
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
