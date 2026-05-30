import { exchangeToken } from "@/lib/broker-fyers";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";

function html(body: string): Response {
  return new Response(
    `<html><body style="background:#0f172a;color:#fff;font-family:sans-serif;text-align:center;padding:3rem">${body}</body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!code) return html("<h2>❌ No auth code received</h2>");
  const { data } = await supabase.from("settings").select("key,value").in("key", ["fyers_pending_appid", "fyers_pending_secret"]);
  const cfg = Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
  if (!cfg.fyers_pending_appid || !cfg.fyers_pending_secret) return html("<h2>❌ Session expired. Start login again.</h2>");
  try {
    const s = await exchangeToken(cfg.fyers_pending_appid, cfg.fyers_pending_secret, code);
    await supabase.from("settings").delete().in("key", ["fyers_pending_appid", "fyers_pending_secret"]);
    return html(`<h2>✅ Fyers Connected!</h2><p>UID: ${s.uid}</p><p>You can close this window.</p>
      <script>try{window.opener&&window.opener.postMessage({type:'fyers_login_complete'},'*')}catch(e){}setTimeout(()=>window.close(),2000)</script>`);
  } catch (e) {
    return html(`<h2>❌ Login Failed</h2><p>${String(e)}</p>`);
  }
}
