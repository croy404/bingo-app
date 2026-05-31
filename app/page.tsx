"use client";
import { useEffect, useState, useCallback } from "react";

const api = (p: string, o: RequestInit = {}) => fetch("/api" + p, o).then(r => r.json()).catch(() => ({}));
const fmt = (n: number | null | undefined) => n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtPct = (n: number | null | undefined) => n == null ? "—" : `${n >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`;
const cc = (n: number | null | undefined) => !n ? "text-slate-400" : n > 0 ? "text-green-400" : "text-red-400";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

type Tab = "dashboard" | "portfolio" | "sip" | "intraday" | "watchlist" | "options" | "screener" | "journal" | "alerts" | "filings" | "news" | "brokers" | "symbols" | "settings";

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [mktStatus, setMktStatus] = useState<{ isOpen: boolean; message: string; dayName: string; appActive?: boolean; appReason?: string } | null>(null);
  const [indices, setIndices] = useState<{ name: string; exchange: string; ltp: number; changePercent: number }[]>([]);
  const [nifty50, setNifty50] = useState<{ symbol: string; name: string; sector: string; ltp: number; changePercent: number }[]>([]);
  const [fiiDii, setFiiDii] = useState<{ date: string; fiiNetEquity: number; diiNetEquity: number }[]>([]);
  const [breadth, setBreadth] = useState<{ advances: number; declines: number; unchanged: number; total: number } | null>(null);
  const [news, setNews] = useState<{ title: string; link: string; pubDate: string; source: string }[]>([]);
  const [portfolio, setPortfolio] = useState<{ holdings: Record<string, unknown>[]; summary: Record<string, number> } | null>(null);
  const [watchlist, setWatchlist] = useState<{ id: number; symbol: string; exchange: string }[]>([]);
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([]);
  const [alertHistory, setAlertHistory] = useState<Record<string, unknown>[]>([]);
  const [journal, setJournal] = useState<Record<string, unknown>[]>([]);
  const [intraday, setIntraday] = useState<{ date: string; trades: Record<string, unknown>[] } | null>(null);
  const [intradaySummary, setIntradaySummary] = useState<{ totalPnl: number; totalTrades: number; winRate: number; perSymbol: Record<string, unknown>[] } | null>(null);
  const [screener, setScreener] = useState<Record<string, unknown>[]>([]);
  const [sectorRot, setSectorRot] = useState<{ sector: string; avgChangePct: number; advancers: number; decliners: number }[]>([]);
  const [options, setOptions] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [aiStatus, setAiStatus] = useState<{ providers: { name: string; configured: boolean }[] } | null>(null);

  // Form state
  const [pSym, setPSym] = useState(""); const [pEx, setPEx] = useState("NSE");
  const [pQty, setPQty] = useState(""); const [pAvg, setPAvg] = useState("");
  const [pDate, setPDate] = useState(""); const [pNotes, setPNotes] = useState("");
  const [wlSym, setWlSym] = useState(""); const [wlEx, setWlEx] = useState("NSE");
  const [alSym, setAlSym] = useState(""); const [alEx, setAlEx] = useState("NSE");
  const [alCond, setAlCond] = useState(">"); const [alPrice, setAlPrice] = useState("");
  const [alType, setAlType] = useState("once");
  const [jDate, setJDate] = useState(today()); const [jSym, setJSym] = useState("");
  const [jDir, setJDir] = useState("BUY"); const [jQty, setJQty] = useState("");
  const [jEntry, setJEntry] = useState(""); const [jExit, setJExit] = useState("");
  const [jSetup, setJSetup] = useState(""); const [jEmotion, setJEmotion] = useState("");
  const [jNotes, setJNotes] = useState("");
  const [idDate, setIdDate] = useState(today()); const [idSym, setIdSym] = useState("");
  const [idSide, setIdSide] = useState("BUY"); const [idQty, setIdQty] = useState("");
  const [idPrice, setIdPrice] = useState("");
  const [optSym, setOptSym] = useState("NIFTY");
  const [screenerType, setScreenerType] = useState("gainers");
  const [journalNote, setJournalNote] = useState(""); const [jnDate, setJnDate] = useState(today());
  // Broker state
  const [iciciStatus, setIciciStatus] = useState<{ connected: boolean; userName?: string; hasSecret?: boolean } | null>(null);
  const [fyersStatus, setFyersStatus] = useState<{ connected: boolean; uid?: string } | null>(null);
  const [iciKey, setIciKey] = useState(""); const [iciSecret, setIciSecret] = useState(""); const [iciToken, setIciToken] = useState("");
  const [fyAppId, setFyAppId] = useState(""); const [fySecret, setFySecret] = useState("");
  // Symbols state
  const [symStatus, setSymStatus] = useState<{ total: number; byExchange: Record<string, number> } | null>(null);
  const [symDownloading, setSymDownloading] = useState(false);
  const [symQuery, setSymQuery] = useState(""); const [symResults, setSymResults] = useState<{ symbol: string; name: string; exchange: string; type: string }[]>([]);
  // Filings
  const [filings, setFilings] = useState<{ id: number; exchange: string; symbol?: string; company?: string; category?: string; subject?: string; attachment?: string; createdAt: string }[]>([]);
  // SIP
  const [sips, setSips] = useState<{ id: number; name: string; symbol: string; frequency: string; amount: number }[]>([]);
  const [sipPerf, setSipPerf] = useState<Record<number, { xirr: number | null; invested: number; units: number; currentValue: number }>>({});
  const [sipName, setSipName] = useState(""); const [sipSym, setSipSym] = useState("");
  const [sipFreq, setSipFreq] = useState("monthly"); const [sipAmt, setSipAmt] = useState("");
  // AI result panels
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState(""); const [aiTitle, setAiTitle] = useState("");

  const loadDashboard = useCallback(async () => {
    const [s, i, n, b, fd] = await Promise.all([
      api("/market/status"), api("/market/indices"), api("/market/nifty50"),
      api("/market/breadth"), api("/market/fii-dii"),
    ]);
    setMktStatus(s); setIndices(i); setNifty50(n); setBreadth(b);
    setFiiDii(fd?.data ?? []);
  }, []);

  // Auto-refresh only while the market window is active (08:55–15:45 IST, trading days).
  // Outside it we refresh once, then stop polling — saves API/AI load and shows last close.
  // When a broker login popup completes, it postMessages back → refresh status.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const t = (e.data && (e.data as { type?: string }).type) || "";
      if (t === "icici_login_complete" || t === "fyers_login_complete") refreshBrokers();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const tick = async () => {
      const s = await api("/market/status");
      if (cancelled) return;
      if (s?.appActive) {
        await loadDashboard();
        if (!timer) timer = setInterval(loadDashboard, 60000);
      } else {
        await loadDashboard();           // one snapshot (served from cache server-side)
        if (timer) { clearInterval(timer); timer = null; }
      }
    };
    tick();
    const guard = setInterval(tick, 5 * 60000); // re-check window every 5 min
    return () => { cancelled = true; if (timer) clearInterval(timer); clearInterval(guard); };
  }, [loadDashboard]);

  const switchTab = async (t: Tab) => {
    setTab(t);
    if (t === "portfolio") { const r = await api("/portfolio/pnl"); setPortfolio(r); }
    if (t === "watchlist") { const r = await api("/watchlist"); setWatchlist(r); }
    if (t === "alerts") { const [a, h] = await Promise.all([api("/alerts"), api("/alerts/history")]); setAlerts(a); setAlertHistory(h); }
    if (t === "journal") { const r = await api("/journal"); setJournal(r); const jn = await api(`/journal/notes?date=${jnDate}`); setJournalNote(jn.content ?? ""); }
    if (t === "intraday") { const [tr, sm] = await Promise.all([api(`/intraday?date=${idDate}`), api(`/intraday/summary?date=${idDate}`)]); setIntraday(tr); setIntradaySummary(sm); }
    if (t === "screener") { const [sc, sr] = await Promise.all([api(`/market/screener?type=${screenerType}`), api("/market/sector-rotation")]); setScreener(sc); setSectorRot(sr); }
    if (t === "news") { const r = await api("/market/news"); setNews(r.items ?? []); }
    if (t === "filings") { const r = await api("/filings"); setFilings(Array.isArray(r) ? r : []); }
    if (t === "sip") { await loadSips(); }
    if (t === "brokers") {
      const [ic, fy, saved] = await Promise.all([api("/broker/icici/status"), api("/broker/fyers/status"), api("/broker/icici/saved-key")]);
      setIciciStatus({ ...ic, hasSecret: saved.hasSecret }); setFyersStatus(fy);
      if (saved.apiKey) setIciKey(saved.apiKey);
    }
    if (t === "symbols") { const r = await api("/symbols/status"); setSymStatus(r); }
    if (t === "settings") { const [s, ai] = await Promise.all([api("/settings"), api("/ai/status")]); setSettings(s); setAiStatus(ai); }
  };

  const refreshBrokers = async () => { const [ic, fy] = await Promise.all([api("/broker/icici/status"), api("/broker/fyers/status")]); setIciciStatus(ic); setFyersStatus(fy); };

  const loadSips = async () => {
    const list = await api("/sip");
    setSips(Array.isArray(list) ? list : []);
    const perf: Record<number, { xirr: number | null; invested: number; units: number; currentValue: number }> = {};
    await Promise.all((Array.isArray(list) ? list : []).map(async (s: { id: number }) => { perf[s.id] = await api(`/sip/${s.id}/performance`); }));
    setSipPerf(perf);
  };

  // Generic AI runner — POST (with body) or GET, shows result in a shared panel
  const runAI = async (title: string, path: string, body?: unknown) => {
    setAiBusy(true); setAiTitle(title); setAiText("Thinking…");
    const r = body !== undefined
      ? await api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await api(path);
    setAiBusy(false);
    if (r.error) { setAiText("⚠️ " + r.error); return; }
    const out = r.summary || r.analysis || r.research || r.plan || r.insight ||
      (r.ideas ? JSON.stringify(r.ideas, null, 2) : "") ||
      (r.overallScore != null ? `Score ${r.overallScore}/100 — ${r.verdict}\n\nTop risks:\n${(r.topRisks||[]).map((x:string)=>"• "+x).join("\n")}\n\nActions:\n${(r.suggestedActions||[]).map((x:string)=>"• "+x).join("\n")}` : "") ||
      "No response.";
    setAiText(out + (r.provider ? `\n\n— via ${r.provider}` : ""));
  };

  const tabCls = (t: Tab) => `cursor-pointer px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${tab===t ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-700"}`;
  const inp = "bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-slate-200 text-sm w-full";
  const btn = (c: string) => `px-3 py-1.5 rounded-md text-sm font-semibold cursor-pointer border-none ${c}`;
  const card = "bg-slate-800 border border-slate-700 rounded-xl p-4";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-2 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">BINGO</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${mktStatus?.isOpen ? "bg-green-900 text-green-400" : "bg-slate-700 text-slate-400"}`}>
            {mktStatus?.isOpen ? "● LIVE" : "● CLOSED"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {mktStatus && mktStatus.appActive === false && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-900/60 text-amber-300">
              ⏸ Live updates paused — {mktStatus.appReason === "weekend" ? "weekend" : mktStatus.appReason === "nse_holiday" ? "NSE holiday" : mktStatus.appReason === "pre_open" ? "pre-open" : "after close"} · showing last close
            </span>
          )}
          <span className="text-xs text-slate-500">{mktStatus?.message} · {mktStatus?.dayName}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 py-2 border-b border-slate-700 overflow-x-auto bg-slate-900">
        {(["dashboard","portfolio","sip","intraday","watchlist","options","screener","journal","alerts","filings","news","brokers","symbols","settings"] as Tab[]).map(t => (
          <div key={t} className={tabCls(t)} onClick={() => switchTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</div>
        ))}
      </div>

      <div className="p-6 max-w-screen-2xl mx-auto">

        {/* ─── DASHBOARD ─── */}
        {tab === "dashboard" && (
          <div>
            <div className="flex justify-end mb-2">
              <button className={btn("bg-purple-700 text-white")} disabled={aiBusy} onClick={()=>runAI("AI Market Summary","/ai/market-summary")}>🤖 AI Market Summary</button>
            </div>
            {/* Indices */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-2 mb-4">
              {indices.map(idx => (
                <div key={idx.name} className={`${card} text-center ${["US","JP","HK"].includes(idx.exchange) ? "opacity-70" : ""}`}>
                  <div className="text-xs text-slate-500 mb-1">{idx.name}</div>
                  <div className="text-base font-bold">{fmt(idx.ltp)}</div>
                  <div className={`text-xs ${cc(idx.changePercent)}`}>{fmtPct(idx.changePercent)}</div>
                </div>
              ))}
            </div>

            {/* Breadth + FII/DII */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className={card}>
                <div className="text-sm font-semibold mb-2 text-slate-300">Market Breadth</div>
                {breadth && (
                  <div className="flex gap-4 mt-2">
                    <div className="text-center"><div className="text-2xl font-bold text-green-400">{breadth.advances}</div><div className="text-xs text-slate-500">Advances</div></div>
                    <div className="text-center"><div className="text-2xl font-bold text-red-400">{breadth.declines}</div><div className="text-xs text-slate-500">Declines</div></div>
                    <div className="text-center"><div className="text-2xl font-bold text-slate-400">{breadth.unchanged}</div><div className="text-xs text-slate-500">Unchanged</div></div>
                  </div>
                )}
              </div>
              <div className={`${card} col-span-2`}>
                <div className="text-sm font-semibold mb-2 text-slate-300">FII/DII Flow (₹ Cr)</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs"><thead><tr className="text-slate-500 border-b border-slate-700"><th className="text-left py-1">Date</th><th className="text-right">FII Net</th><th className="text-right">DII Net</th></tr></thead>
                  <tbody>{fiiDii.slice(-5).reverse().map(r => (
                    <tr key={r.date} className="border-b border-slate-800">
                      <td className="py-1">{r.date}</td>
                      <td className={`text-right ${cc(r.fiiNetEquity)}`}>{r.fiiNetEquity >= 0 ? "+" : ""}{fmt(r.fiiNetEquity)}</td>
                      <td className={`text-right ${cc(r.diiNetEquity)}`}>{r.diiNetEquity >= 0 ? "+" : ""}{fmt(r.diiNetEquity)}</td>
                    </tr>
                  ))}</tbody></table>
                </div>
              </div>
            </div>

            {/* Heatmap */}
            <div className={card}>
              <div className="text-sm font-semibold mb-3 text-slate-300">Nifty 50 Heatmap</div>
              <div className="flex flex-wrap gap-1.5">
                {nifty50.map(s => {
                  const pct = s.changePercent; const intensity = Math.min(Math.abs(pct) / 3, 1);
                  const bg = pct > 0 ? `rgba(34,197,94,${0.15+intensity*0.6})` : pct < 0 ? `rgba(239,68,68,${0.15+intensity*0.6})` : "rgba(100,116,139,0.2)";
                  return (
                    <div key={s.symbol} title={`${s.symbol}\n₹${s.ltp}\n${s.changePercent}%`}
                      style={{ background: bg }} className="rounded-lg p-1.5 text-center min-w-[80px] cursor-default hover:scale-105 transition-transform">
                      <div className="text-xs font-bold">{s.symbol}</div>
                      <div className="text-[10px] text-slate-400">{s.sector}</div>
                      <div className={`text-xs font-semibold ${cc(pct)}`}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── PORTFOLIO ─── */}
        {tab === "portfolio" && (
          <div>
            <div className="flex gap-2 mb-3 flex-wrap">
              <button className={btn("bg-purple-700 text-white")} disabled={aiBusy} onClick={()=>runAI("Portfolio Risk Score","/ai/risk-score",{})}>🤖 AI Risk Score</button>
              <a className={btn("bg-slate-600 text-white")} href="/api/export?type=portfolio">⬇ Export CSV</a>
            </div>
            {portfolio?.summary && (
              <div className={`${card} mb-4 flex gap-6 flex-wrap`}>
                {[["Invested","totalInvested"],["Current","totalCurrent"],["P&L","totalPnl"],["Return","totalPnlPercent"]].map(([label, key]) => (
                  <div key={key}><div className="text-xs text-slate-500">{label}</div>
                    <div className={`text-xl font-bold ${key.includes("Pnl")||key.includes("Percent") ? cc(portfolio.summary[key]) : ""}`}>
                      {key.includes("Percent") ? fmtPct(portfolio.summary[key]) : `₹${fmt(portfolio.summary[key])}`}
                    </div></div>
                ))}
              </div>
            )}
            <div className={`${card} mb-4`}>
              <div className="text-sm font-semibold mb-3">Add Holding</div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                <input className={inp} placeholder="Symbol" value={pSym} onChange={e=>setPSym(e.target.value.toUpperCase())} />
                <select className={inp} value={pEx} onChange={e=>setPEx(e.target.value)}><option>NSE</option><option>BSE</option></select>
                <input className={inp} type="number" placeholder="Qty" value={pQty} onChange={e=>setPQty(e.target.value)} />
                <input className={inp} type="number" placeholder="Avg Price" value={pAvg} onChange={e=>setPAvg(e.target.value)} />
                <input className={inp} type="date" value={pDate} onChange={e=>setPDate(e.target.value)} />
                <input className={inp} placeholder="Notes" value={pNotes} onChange={e=>setPNotes(e.target.value)} />
                <button className={btn("bg-blue-600 text-white hover:bg-blue-700")} onClick={async()=>{
                  if(!pSym||!pQty||!pAvg){alert("Fill symbol, qty, avg price");return;}
                  await api("/portfolio",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:pSym,exchange:pEx,qty:+pQty,avg_price:+pAvg,buy_date:pDate,notes:pNotes})});
                  const r=await api("/portfolio/pnl");setPortfolio(r);
                  setPSym("");setPQty("");setPAvg("");
                }}>Add</button>
              </div>
            </div>
            <div className={card}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-500 text-xs border-b border-slate-700">
                    <th className="text-left py-2">Symbol</th><th className="text-left">Sector</th><th>Qty</th><th>Avg</th><th>LTP</th><th>Invested</th><th>Current</th><th>P&L</th><th>%</th><th>XIRR</th><th></th>
                  </tr></thead>
                  <tbody>{(portfolio?.holdings ?? []).map((h: Record<string, unknown>) => (
                    <tr key={String(h.id)} className="border-b border-slate-800 hover:bg-slate-750">
                      <td className="py-1.5 font-semibold">{String(h.symbol)}<br/><span className="text-xs text-slate-500">{String(h.exchange)}</span></td>
                      <td className="text-xs text-slate-400">{String(h.sector||"—")}</td>
                      <td className="text-center">{String(h.qty)}</td>
                      <td className="text-right">₹{fmt(Number(h.avg_price))}</td>
                      <td className="text-right">₹{fmt(Number(h.ltp))}</td>
                      <td className="text-right">₹{fmt(Number(h.invested))}</td>
                      <td className="text-right">₹{fmt(Number(h.current))}</td>
                      <td className={`text-right ${cc(Number(h.pnl))}`}>₹{fmt(Number(h.pnl))}</td>
                      <td className={`text-right ${cc(Number(h.pnlPercent))}`}>{fmtPct(Number(h.pnlPercent))}</td>
                      <td className="text-right text-cyan-400">{h.xirr != null ? `${Number(h.xirr).toFixed(1)}%` : "—"}</td>
                      <td><button className="text-red-400 hover:text-red-300 px-2" onClick={async()=>{await api("/portfolio",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:h.id})});const r=await api("/portfolio/pnl");setPortfolio(r);}}>✕</button></td>
                    </tr>
                  ))}</tbody>
                </table>
                {!portfolio?.holdings?.length && <div className="text-center text-slate-500 py-6">No holdings yet</div>}
              </div>
            </div>
          </div>
        )}

        {/* ─── SIP ─── */}
        {tab === "sip" && (
          <div>
            <div className={`${card} mb-4`}>
              <div className="text-sm font-semibold mb-3">Add SIP</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <input className={inp} placeholder="Name (e.g. Nifty SIP)" value={sipName} onChange={e=>setSipName(e.target.value)} />
                <input className={inp} placeholder="Symbol / Fund" value={sipSym} onChange={e=>setSipSym(e.target.value.toUpperCase())} />
                <select className={inp} value={sipFreq} onChange={e=>setSipFreq(e.target.value)}><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="quarterly">Quarterly</option></select>
                <input className={inp} type="number" placeholder="Amount ₹" value={sipAmt} onChange={e=>setSipAmt(e.target.value)} />
                <button className={btn("bg-blue-600 text-white")} onClick={async()=>{
                  if(!sipName||!sipSym||!sipAmt){alert("Fill name, symbol, amount");return;}
                  await api("/sip",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:sipName,symbol:sipSym,frequency:sipFreq,amount:+sipAmt})});
                  setSipName("");setSipSym("");setSipAmt("");await loadSips();
                }}>Add SIP</button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {sips.map(s => { const p = sipPerf[s.id] || {xirr:null,invested:0,units:0,currentValue:0}; return (
                <div key={s.id} className={card}>
                  <div className="flex justify-between items-center mb-2">
                    <div><b>{s.name}</b> <span className="text-xs bg-slate-700 px-2 py-0.5 rounded">{s.symbol}</span> <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded">{s.frequency}</span></div>
                    <button className="text-red-400 text-sm" onClick={async()=>{if(!confirm("Delete SIP?"))return;await api("/sip",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:s.id})});await loadSips();}}>Delete</button>
                  </div>
                  <div className="flex gap-6 flex-wrap text-sm">
                    <div><div className="text-xs text-slate-500">Invested</div><b>₹{fmt(p.invested)}</b></div>
                    <div><div className="text-xs text-slate-500">Units</div><b>{p.units}</b></div>
                    <div><div className="text-xs text-slate-500">Current</div><b>₹{fmt(p.currentValue)}</b></div>
                    <div><div className="text-xs text-slate-500">XIRR</div><b className="text-cyan-400">{p.xirr!=null?p.xirr+"%":"—"}</b></div>
                  </div>
                  <SipTx sipId={s.id} onAdd={loadSips} api={api} inp={inp} btn={btn} fmt={fmt} />
                </div>
              );})}
              {!sips.length && <div className="text-center text-slate-500 py-10">No SIPs yet. Add one above and log each instalment to track XIRR.</div>}
            </div>
          </div>
        )}

        {/* ─── INTRADAY ─── */}
        {tab === "intraday" && (
          <div>
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <input className={`${inp} max-w-[160px]`} type="date" value={idDate} onChange={e=>setIdDate(e.target.value)} />
              <button className={btn("bg-blue-600 text-white")} onClick={async()=>{const [tr,sm]=await Promise.all([api(`/intraday?date=${idDate}`),api(`/intraday/summary?date=${idDate}`)]);setIntraday(tr);setIntradaySummary(sm);}}>Load</button>
            </div>
            {intradaySummary && (
              <div className={`${card} mb-4`}>
                <div className="flex gap-6 mb-3">
                  <div><div className="text-xs text-slate-500">Net P&L</div><div className={`text-xl font-bold ${cc(intradaySummary.totalPnl)}`}>₹{fmt(intradaySummary.totalPnl)}</div></div>
                  <div><div className="text-xs text-slate-500">Trades</div><div className="text-xl font-bold">{intradaySummary.totalTrades}</div></div>
                  <div><div className="text-xs text-slate-500">Win Rate</div><div className="text-xl font-bold">{intradaySummary.winRate}%</div></div>
                </div>
                {(intradaySummary.perSymbol ?? []).map((s: Record<string, unknown>) => (
                  <div key={String(s.symbol)} className="flex justify-between text-sm border-b border-slate-700 py-1">
                    <span><b>{String(s.symbol)}</b> <span className={`text-xs px-1 rounded ${s.status==="Closed"?"bg-green-900 text-green-400":s.status==="Open"?"bg-blue-900 text-blue-400":"bg-yellow-900 text-yellow-400"}`}>{String(s.status)}</span></span>
                    <span className={cc(Number(s.realized_pnl))}>₹{fmt(Number(s.realized_pnl))}</span>
                  </div>
                ))}
              </div>
            )}
            <div className={`${card} mb-4`}>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <input className={inp} placeholder="Symbol" value={idSym} onChange={e=>setIdSym(e.target.value.toUpperCase())} />
                <select className={inp} value={idSide} onChange={e=>setIdSide(e.target.value)}><option>BUY</option><option>SELL</option></select>
                <input className={inp} type="number" placeholder="Qty" value={idQty} onChange={e=>setIdQty(e.target.value)} />
                <input className={inp} type="number" placeholder="Price" value={idPrice} onChange={e=>setIdPrice(e.target.value)} />
                <button className={btn("bg-green-600 text-white col-span-2")} onClick={async()=>{
                  if(!idSym||!idQty||!idPrice)return;
                  await api("/intraday",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:idSym,side:idSide,qty:+idQty,price:+idPrice,trade_date:idDate})});
                  const [tr,sm]=await Promise.all([api(`/intraday?date=${idDate}`),api(`/intraday/summary?date=${idDate}`)]);setIntraday(tr);setIntradaySummary(sm);
                  setIdSym("");setIdQty("");setIdPrice("");
                }}>Add Trade</button>
              </div>
            </div>
            <div className={card}>
              <table className="w-full text-sm"><thead><tr className="text-slate-500 text-xs border-b border-slate-700"><th className="text-left py-1">Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Notes</th><th></th></tr></thead>
              <tbody>{(intraday?.trades ?? []).map((t: Record<string, unknown>) => (
                <tr key={String(t.id)} className="border-b border-slate-800">
                  <td className="py-1 font-semibold">{String(t.symbol)}</td>
                  <td className="text-center"><span className={`px-1.5 py-0.5 rounded text-xs font-bold ${t.side==="BUY"?"bg-green-900 text-green-400":"bg-red-900 text-red-400"}`}>{String(t.side)}</span></td>
                  <td className="text-center">{String(t.qty)}</td>
                  <td className="text-right">₹{fmt(Number(t.price))}</td>
                  <td className="text-slate-400 text-xs">{String(t.notes||"")}</td>
                  <td><button className="text-red-400 px-2" onClick={async()=>{await api("/intraday",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id})});const [tr,sm]=await Promise.all([api(`/intraday?date=${idDate}`),api(`/intraday/summary?date=${idDate}`)]);setIntraday(tr);setIntradaySummary(sm);}}>✕</button></td>
                </tr>
              ))}</tbody></table>
              {!intraday?.trades?.length && <div className="text-center text-slate-500 py-4">No trades for {idDate}</div>}
            </div>
          </div>
        )}

        {/* ─── WATCHLIST ─── */}
        {tab === "watchlist" && (
          <div>
            <div className={`${card} mb-4`}>
              <div className="flex gap-2">
                <input className={`${inp} max-w-[200px]`} placeholder="Symbol" value={wlSym} onChange={e=>setWlSym(e.target.value.toUpperCase())} />
                <select className={`${inp} max-w-[100px]`} value={wlEx} onChange={e=>setWlEx(e.target.value)}><option>NSE</option><option>BSE</option></select>
                <button className={btn("bg-blue-600 text-white")} onClick={async()=>{if(!wlSym)return;await api("/watchlist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:wlSym,exchange:wlEx})});const r=await api("/watchlist");setWatchlist(r);setWlSym("");}}>Add</button>
              </div>
            </div>
            <div className={card}>
              <table className="w-full text-sm"><thead><tr className="text-slate-500 text-xs border-b border-slate-700"><th className="text-left py-1">Symbol</th><th>Exchange</th><th></th></tr></thead>
              <tbody>{watchlist.map(w => (
                <tr key={w.id} className="border-b border-slate-800">
                  <td className="py-1.5 font-semibold">{w.symbol}</td>
                  <td className="text-center text-slate-400">{w.exchange}</td>
                  <td><button className="text-red-400 px-2" onClick={async()=>{await api("/watchlist",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:w.id})});const r=await api("/watchlist");setWatchlist(r);}}>✕</button></td>
                </tr>
              ))}</tbody></table>
              {!watchlist.length && <div className="text-center text-slate-500 py-4">Watchlist empty</div>}
            </div>
          </div>
        )}

        {/* ─── OPTIONS ─── */}
        {tab === "options" && (
          <div>
            <div className={`${card} mb-4 flex gap-2 flex-wrap items-center`}>
              <input className={`${inp} max-w-[160px]`} placeholder="Symbol (e.g. NIFTY)" value={optSym} onChange={e=>setOptSym(e.target.value.toUpperCase())} />
              <button className={btn("bg-blue-600 text-white")} onClick={async()=>{const r=await api(`/options?symbol=${optSym}`);setOptions(r);}}>Load</button>
              {options && <span className="text-sm text-slate-400">Underlying: ₹{fmt(Number((options as Record<string,unknown>).underlying))} | PCR: {String((options as Record<string,unknown>).pcr)}</span>}
            </div>
            {options && (
              <div className={`${card} overflow-x-auto`}>
                <table className="w-full text-xs"><thead><tr className="text-slate-500 border-b border-slate-700">
                  <th className="text-right py-1">CE OI</th><th className="text-right">CE Vol</th><th className="text-right">CE IV</th>
                  <th className="text-right text-green-400">CE LTP</th><th className="text-center bg-slate-900">STRIKE</th>
                  <th className="text-red-400">PE LTP</th><th>PE IV</th><th>PE Vol</th><th>PE OI</th>
                </tr></thead>
                <tbody>{((options as Record<string,unknown[]>).chain ?? []).map((r: unknown) => {
                  const row = r as { strike: number; ce: Record<string,number>; pe: Record<string,number> };
                  const atm = Math.abs(row.strike - Number((options as Record<string,unknown>).underlying)) < 200;
                  return (
                    <tr key={row.strike} className={`border-b border-slate-800 ${atm?"bg-blue-950":""}`}>
                      <td className="text-right py-0.5">{(row.ce.oi/100000).toFixed(1)}L</td>
                      <td className="text-right">{(row.ce.vol/1000).toFixed(1)}K</td>
                      <td className="text-right">{row.ce.iv.toFixed(1)}%</td>
                      <td className="text-right text-green-400 font-bold">₹{fmt(row.ce.ltp)}</td>
                      <td className="text-center font-bold bg-slate-900">₹{fmt(row.strike)}</td>
                      <td className="text-red-400 font-bold">₹{fmt(row.pe.ltp)}</td>
                      <td>{row.pe.iv.toFixed(1)}%</td>
                      <td>{(row.pe.vol/1000).toFixed(1)}K</td>
                      <td>{(row.pe.oi/100000).toFixed(1)}L</td>
                    </tr>
                  );
                })}</tbody></table>
              </div>
            )}
          </div>
        )}

        {/* ─── SCREENER ─── */}
        {tab === "screener" && (
          <div>
            <div className={`${card} mb-4 flex gap-2 flex-wrap`}>
              <button className={btn(`${screenerType==="gainers"?"bg-green-700":"bg-slate-700"} text-white`)} onClick={async()=>{setScreenerType("gainers");const r=await api("/market/screener?type=gainers");setScreener(r);}}>▲ Gainers</button>
              <button className={btn(`${screenerType==="losers"?"bg-red-700":"bg-slate-700"} text-white`)} onClick={async()=>{setScreenerType("losers");const r=await api("/market/screener?type=losers");setScreener(r);}}>▼ Losers</button>
              <button className={btn("bg-blue-700 text-white")} onClick={async()=>{const r=await api("/market/52week");setScreener(((r.nearHigh||[]) as Record<string,unknown>[]).map((s)=>({symbol:s.symbol,ltp:s.ltp,change:0,changePercent:s.pChange,volume:0})));setScreenerType("52w high");}}>52W Highs</button>
              <button className={btn("bg-amber-700 text-white")} onClick={async()=>{const r=await api("/screener/volume-surges?ratio=2");setScreener(((r.rows||[]) as Record<string,unknown>[]).map((s)=>({symbol:s.symbol,ltp:s.ltp,change:0,changePercent:s.changePercent,volume:s.volume})));setScreenerType("volume surge");}}>Volume Surge</button>
              <button className={btn("bg-purple-700 text-white")} disabled={aiBusy} onClick={()=>runAI("Trade Ideas","/ai/trade-ideas",{topGainers:screener.slice(0,5).map((s:Record<string,unknown>)=>({symbol:s.symbol,changePct:s.changePercent}))})}>🤖 AI Ideas</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={card}>
                <div className="text-sm font-semibold mb-2">{screenerType === "gainers" ? "Top Gainers" : "Top Losers"}</div>
                <table className="w-full text-sm"><thead><tr className="text-slate-500 text-xs border-b border-slate-700"><th className="text-left py-1">Symbol</th><th>LTP</th><th>Change</th><th>%</th><th>Volume</th></tr></thead>
                <tbody>{screener.map((s: Record<string, unknown>) => (
                  <tr key={String(s.symbol)} className="border-b border-slate-800">
                    <td className="py-1 font-semibold">{String(s.symbol)}</td>
                    <td className="text-right">₹{fmt(Number(s.ltp))}</td>
                    <td className={`text-right ${cc(Number(s.change))}`}>₹{fmt(Number(s.change))}</td>
                    <td className={`text-right ${cc(Number(s.changePercent))}`}>{fmtPct(Number(s.changePercent))}</td>
                    <td className="text-right text-slate-400">{(Number(s.volume)/100000).toFixed(1)}L</td>
                  </tr>
                ))}</tbody></table>
              </div>
              <div className={card}>
                <div className="text-sm font-semibold mb-2">Sector Rotation</div>
                {sectorRot.map(s => (
                  <div key={s.sector} className="flex justify-between items-center border-b border-slate-700 py-1 text-sm">
                    <span>{s.sector}</span>
                    <span className={cc(s.avgChangePct)}>{fmtPct(s.avgChangePct)}</span>
                    <span className="text-xs text-slate-500">{s.advancers}▲ {s.decliners}▼</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── JOURNAL ─── */}
        {tab === "journal" && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className={card}>
                <div className="text-sm font-semibold mb-3">Log Trade</div>
                <div className="grid grid-cols-2 gap-2">
                  <input className={inp} type="date" value={jDate} onChange={e=>setJDate(e.target.value)} />
                  <input className={inp} placeholder="Symbol" value={jSym} onChange={e=>setJSym(e.target.value.toUpperCase())} />
                  <select className={inp} value={jDir} onChange={e=>setJDir(e.target.value)}><option>BUY</option><option>SELL</option></select>
                  <input className={inp} placeholder="Setup" value={jSetup} onChange={e=>setJSetup(e.target.value)} />
                  <input className={inp} type="number" placeholder="Qty" value={jQty} onChange={e=>setJQty(e.target.value)} />
                  <input className={inp} type="number" placeholder="Entry" value={jEntry} onChange={e=>setJEntry(e.target.value)} />
                  <input className={inp} type="number" placeholder="Exit" value={jExit} onChange={e=>setJExit(e.target.value)} />
                  <select className={inp} value={jEmotion} onChange={e=>setJEmotion(e.target.value)}>
                    <option value="">Emotion</option><option>Confident</option><option>Fearful</option><option>FOMO</option><option>Disciplined</option><option>Revenge</option>
                  </select>
                </div>
                <textarea className={`${inp} mt-2 h-16 resize-none`} placeholder="Notes / learnings" value={jNotes} onChange={e=>setJNotes(e.target.value)} />
                <button className={`${btn("bg-blue-600 text-white")} w-full mt-2`} onClick={async()=>{
                  if(!jDate||!jSym||!jQty||!jEntry)return;
                  await api("/journal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trade_date:jDate,symbol:jSym,direction:jDir,qty:+jQty,entry_price:+jEntry,exit_price:jExit?+jExit:null,setup:jSetup,emotion:jEmotion,notes:jNotes})});
                  const r=await api("/journal");setJournal(r);setJSym("");setJQty("");setJEntry("");setJExit("");
                }}>Log Trade</button>
              </div>
              <div className={card}>
                <div className="text-sm font-semibold mb-2">Daily Note</div>
                <input className={`${inp} mb-2`} type="date" value={jnDate} onChange={async e=>{setJnDate(e.target.value);const r=await api(`/journal/notes?date=${e.target.value}`);setJournalNote(r.content??"");}} />
                <textarea className={`${inp} h-32 resize-none`} placeholder="Market thoughts..." value={journalNote} onChange={e=>setJournalNote(e.target.value)} />
                <button className={`${btn("bg-green-600 text-white")} w-full mt-2`} onClick={async()=>{await api("/journal/notes",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:jnDate,content:journalNote})});}}>Save Note</button>
              </div>
            </div>
            <div className={card}>
              <div className="flex gap-4 mb-3 text-sm items-center">
                <span>Trades: <b>{journal.length}</b></span>
                <span className={cc(journal.reduce((s,r)=>s+Number((r as Record<string,unknown>).pnl||0),0))}>P&L: <b>₹{fmt(journal.reduce((s,r)=>s+Number((r as Record<string,unknown>).pnl||0),0))}</b></span>
                <button className={btn("bg-purple-700 text-white")} disabled={aiBusy} onClick={()=>runAI("Journal Analysis","/ai/journal-analysis",{})}>🤖 AI Analysis</button>
                <a className={btn("bg-slate-600 text-white")} href="/api/export?type=journal">⬇ Export CSV</a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs"><thead><tr className="text-slate-500 border-b border-slate-700"><th className="text-left py-1">Date</th><th>Symbol</th><th>Dir</th><th>Qty</th><th>Entry</th><th>Exit</th><th>P&L</th><th>Setup</th><th>Emotion</th><th></th></tr></thead>
                <tbody>{journal.map((r: Record<string, unknown>) => (
                  <tr key={String(r.id)} className="border-b border-slate-800">
                    <td className="py-1">{String(r.trade_date)}</td>
                    <td className="font-semibold">{String(r.symbol)}</td>
                    <td><span className={`px-1 rounded font-bold ${r.direction==="BUY"?"text-green-400":"text-red-400"}`}>{String(r.direction)}</span></td>
                    <td>{String(r.qty)}</td>
                    <td>₹{fmt(Number(r.entry_price))}</td>
                    <td>{r.exit_price ? `₹${fmt(Number(r.exit_price))}` : "—"}</td>
                    <td className={cc(Number(r.pnl))}>{r.pnl != null ? `₹${fmt(Number(r.pnl))}` : "—"}</td>
                    <td className="text-slate-400">{String(r.setup||"")}</td>
                    <td className="text-slate-400">{String(r.emotion||"")}</td>
                    <td><button className="text-red-400 px-1" onClick={async()=>{await api("/journal",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:r.id})});const jr=await api("/journal");setJournal(jr);}}>✕</button></td>
                  </tr>
                ))}</tbody></table>
              </div>
            </div>
          </div>
        )}

        {/* ─── ALERTS ─── */}
        {tab === "alerts" && (
          <div>
            <div className={`${card} mb-4`}>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                <input className={inp} placeholder="Symbol" value={alSym} onChange={e=>setAlSym(e.target.value.toUpperCase())} />
                <select className={inp} value={alEx} onChange={e=>setAlEx(e.target.value)}><option>NSE</option><option>BSE</option></select>
                <select className={inp} value={alCond} onChange={e=>setAlCond(e.target.value)}><option value=">">Above (&gt;)</option><option value=">=">At or Above (≥)</option><option value="<">Below (&lt;)</option><option value="<=">At or Below (≤)</option></select>
                <input className={inp} type="number" placeholder="Target Price" value={alPrice} onChange={e=>setAlPrice(e.target.value)} />
                <select className={inp} value={alType} onChange={e=>setAlType(e.target.value)}><option value="once">Once</option><option value="recurring">Recurring</option></select>
                <button className={`${btn("bg-blue-600 text-white")} col-span-2`} onClick={async()=>{
                  if(!alSym||!alPrice)return;
                  await api("/alerts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:alSym,exchange:alEx,condition:alCond,price:+alPrice,alert_type:alType})});
                  const r=await api("/alerts");setAlerts(r);setAlSym("");setAlPrice("");
                }}>Set Alert</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={card}>
                <div className="text-sm font-semibold mb-2">Active Alerts</div>
                <table className="w-full text-sm"><thead><tr className="text-slate-500 text-xs border-b border-slate-700"><th className="text-left py-1">Symbol</th><th>Cond</th><th>Target</th><th>Type</th><th>Hits</th><th>Status</th><th></th></tr></thead>
                <tbody>{alerts.map((a: Record<string, unknown>) => (
                  <tr key={String(a.id)} className="border-b border-slate-800">
                    <td className="py-1 font-semibold">{String(a.symbol)}<br/><span className="text-xs text-slate-500">{String(a.exchange)}</span></td>
                    <td className="text-center">{String(a.condition)}</td>
                    <td className="text-right">₹{fmt(Number(a.price))}</td>
                    <td className="text-center text-xs text-slate-400">{String(a.alert_type)}</td>
                    <td className="text-center">{String(a.triggered_count||0)}</td>
                    <td><span className={`text-xs px-1.5 py-0.5 rounded ${a.is_active?"bg-green-900 text-green-400":"bg-slate-700 text-slate-400"}`}>{a.is_active?"On":"Off"}</span></td>
                    <td className="flex gap-1">
                      <button className="text-slate-400 hover:text-white px-1 text-xs" onClick={async()=>{await api("/alerts",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:a.id})});const r=await api("/alerts");setAlerts(r);}}>⏸</button>
                      <button className="text-red-400 px-1" onClick={async()=>{await api("/alerts",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:a.id})});const r=await api("/alerts");setAlerts(r);}}>✕</button>
                    </td>
                  </tr>
                ))}</tbody></table>
                {!alerts.length && <div className="text-center text-slate-500 py-4">No alerts set</div>}
              </div>
              <div className={card}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-semibold">Alert History</span>
                  <button className="text-xs text-red-400" onClick={async()=>{await api("/alerts/history",{method:"DELETE"});setAlertHistory([]);}}>Clear</button>
                </div>
                <table className="w-full text-xs"><thead><tr className="text-slate-500 border-b border-slate-700"><th className="text-left py-1">Symbol</th><th>Cond</th><th>LTP</th><th>When</th></tr></thead>
                <tbody>{alertHistory.map((h: Record<string, unknown>) => (
                  <tr key={String(h.id)} className="border-b border-slate-800">
                    <td className="py-1 font-semibold">{String(h.symbol)}</td>
                    <td>{String(h.condition)} ₹{fmt(Number(h.target_price))}</td>
                    <td>₹{fmt(Number(h.triggered_ltp))}</td>
                    <td className="text-slate-400">{String(h.triggered_at||"").slice(0,16)}</td>
                  </tr>
                ))}</tbody></table>
                {!alertHistory.length && <div className="text-center text-slate-500 py-4">No history</div>}
              </div>
            </div>
          </div>
        )}

        {/* ─── FILINGS ─── */}
        {tab === "filings" && (
          <div>
            <div className={`${card} mb-3 flex items-center justify-between`}>
              <div className="text-sm font-semibold">📄 NSE / BSE Corporate Filings</div>
              <span className="text-xs text-slate-500">Monitored 24/7 · filtered to your watchlist when set</span>
            </div>
            <div className="flex flex-col gap-2">
              {filings.map(f => (
                <div key={f.id} className={card}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700">{f.exchange}{f.symbol ? ` · ${f.symbol}` : ""}</span>
                    <span className="text-xs text-slate-500">{(f.createdAt || "").slice(0, 16).replace("T", " ")}</span>
                  </div>
                  {f.company && <div className="text-sm font-semibold">{f.company}</div>}
                  <div className="text-sm text-slate-300">{f.subject}</div>
                  {f.category && <span className="text-xs text-amber-400">{f.category}</span>}
                  {f.attachment && <a href={f.attachment} target="_blank" rel="noreferrer" className="text-xs text-blue-400 ml-2">🔗 attachment</a>}
                </div>
              ))}
              {!filings.length && <div className="text-center text-slate-500 py-10">No filings yet — the worker polls NSE/BSE every 15 min. New filings appear here and go to Telegram.</div>}
            </div>
          </div>
        )}

        {/* ─── NEWS ─── */}
        {tab === "news" && (
          <div className="flex flex-col gap-3">
            {news.map((n, i) => (
              <div key={i} className={card}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{n.source}</span>
                  <span className="text-xs text-slate-500">{n.pubDate}</span>
                </div>
                <a href={n.link} target="_blank" rel="noreferrer" className="text-slate-200 font-semibold hover:text-blue-400 leading-snug block">{n.title}</a>
              </div>
            ))}
            {!news.length && <div className="text-center text-slate-500 py-10">No news loaded yet</div>}
          </div>
        )}

        {/* ─── BROKERS ─── */}
        {tab === "brokers" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ICICI Breeze */}
            <div className={card}>
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-semibold">🏦 ICICI Direct (Breeze)</div>
                <span className={`text-xs px-2 py-0.5 rounded ${iciciStatus?.connected ? "bg-green-900 text-green-400" : "bg-slate-700 text-slate-400"}`}>
                  {iciciStatus?.connected ? `✓ ${iciciStatus.userName}` : "Not connected"}
                </span>
              </div>
              {iciciStatus?.connected ? (
                <button className={btn("bg-red-600 text-white")} onClick={async()=>{await api("/broker/icici/disconnect",{method:"POST"});refreshBrokers();}}>Disconnect</button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="text-xs bg-slate-900 rounded p-2 text-slate-400 mb-1">
                    <b className="text-amber-400">One-time setup:</b> in your ICICI API app at <span className="text-blue-400">api.icicidirect.com</span>, set the <b>Redirect URL</b> to:<br/>
                    <code className="text-cyan-400 break-all">http://ggkyez6sftnzxqhq1jku14f2.13.203.185.106.sslip.io/api/broker/icici/oauth-callback</code><br/>
                    Then the token is captured automatically. (Until then, use manual paste below.)
                  </div>
                  <input className={inp} placeholder="API Key" value={iciKey} onChange={e=>setIciKey(e.target.value)} />
                  <input className={inp} placeholder={iciciStatus?.hasSecret ? "API Secret (saved — leave blank to reuse)" : "API Secret"} type="password" value={iciSecret} onChange={e=>setIciSecret(e.target.value)} />
                  <div className="flex gap-2">
                    <button className={btn("bg-green-700 text-white")} onClick={async()=>{
                      if(!iciKey||!iciSecret){alert("Enter API Key + Secret first (saved for next time)");return;}
                      const r=await api("/broker/icici/prepare-oauth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:iciKey,apiSecret:iciSecret})});
                      if(r.loginUrl){window.open(r.loginUrl,"_blank");setTimeout(refreshBrokers,6000);} else alert("Failed: "+(r.error||"unknown"));
                    }}>🔐 Login (auto-capture)</button>
                  </div>
                  <details><summary className="text-xs text-slate-500 cursor-pointer">Manual token paste (fallback)</summary>
                    <div className="flex flex-col gap-2 mt-2">
                      <input className={inp} placeholder="apisession token (from the redirect URL)" value={iciToken} onChange={e=>setIciToken(e.target.value)} />
                      <button className={btn("bg-blue-600 text-white")} onClick={async()=>{
                        if(!iciKey||!iciSecret||!iciToken){alert("Fill key, secret, token");return;}
                        const r=await api("/broker/icici/connect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:iciKey,apiSecret:iciSecret,sessionToken:iciToken})});
                        if(r.success){alert("Connected as "+r.userName);refreshBrokers();}else alert("Failed: "+(r.error||"unknown"));
                      }}>Connect with token</button>
                    </div>
                  </details>
                </div>
              )}
            </div>
            {/* Fyers */}
            <div className={card}>
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-semibold">🏦 Fyers</div>
                <span className={`text-xs px-2 py-0.5 rounded ${fyersStatus?.connected ? "bg-green-900 text-green-400" : "bg-slate-700 text-slate-400"}`}>
                  {fyersStatus?.connected ? `✓ ${fyersStatus.uid}` : "Not connected"}
                </span>
              </div>
              {fyersStatus?.connected ? (
                <button className={btn("bg-red-600 text-white")} onClick={async()=>{await api("/broker/fyers/disconnect",{method:"POST"});refreshBrokers();}}>Disconnect</button>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-500">1. Create an app at myapi.fyers.in (redirect URL = this site + /api/broker/fyers/callback)<br/>2. Enter App ID + Secret → Connect (opens Fyers login popup)</p>
                  <input className={inp} placeholder="App ID (e.g. ABC123-100)" value={fyAppId} onChange={e=>setFyAppId(e.target.value)} />
                  <input className={inp} placeholder="Secret Key" type="password" value={fySecret} onChange={e=>setFySecret(e.target.value)} />
                  <button className={btn("bg-blue-600 text-white")} onClick={async()=>{
                    if(!fyAppId||!fySecret){alert("Fill App ID and Secret");return;}
                    const r=await api("/broker/fyers/prepare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({appId:fyAppId,secret:fySecret})});
                    if(r.loginUrl){window.open(r.loginUrl,"_blank");setTimeout(refreshBrokers,8000);}else alert("Failed: "+(r.error||"unknown"));
                  }}>Connect via Fyers Login</button>
                </div>
              )}
            </div>
            <div className={`${card} md:col-span-2`}>
              <p className="text-xs text-slate-500">💡 When a broker is connected, all LTP/quotes across the app use real-time broker data. Without a broker, prices fall back to Yahoo Finance (~15-min delay). Historical candles require a connected broker.</p>
            </div>
          </div>
        )}

        {/* ─── SYMBOLS ─── */}
        {tab === "symbols" && (
          <div>
            <div className={`${card} mb-4`}>
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-semibold">📥 Symbol Master</div>
                <span className="text-xs text-slate-400">Total stored: <b>{symStatus?.total ?? 0}</b></span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Download scrip masters from NSE (equity), NSE F&O, BSE, MCX (commodities), AMFI (mutual funds). Stored in your Supabase DB for symbol search.</p>
              <button className={btn("bg-blue-600 text-white")} disabled={symDownloading} onClick={async()=>{
                setSymDownloading(true);
                const r=await api("/symbols/download",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({exchanges:["NSE","NFO","BSE","MCX","MF"]})});
                setSymDownloading(false);
                alert("Download complete:\n"+JSON.stringify(r.result,null,2));
                const st=await api("/symbols/status");setSymStatus(st);
              }}>{symDownloading ? "Downloading… (takes ~30s)" : "Download All Symbols"}</button>
              {symStatus && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                  {Object.entries(symStatus.byExchange).map(([ex,n]) => (
                    <div key={ex} className="bg-slate-900 rounded-lg p-2 text-center">
                      <div className="text-xs text-slate-500">{ex}</div>
                      <div className="font-bold">{n}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={card}>
              <div className="text-sm font-semibold mb-2">🔍 Search Symbols</div>
              <div className="flex gap-2 mb-3">
                <input className={inp} placeholder="Type symbol (e.g. RELI, GOLD, fund name)" value={symQuery}
                  onChange={async e=>{const q=e.target.value;setSymQuery(q);if(q.length>=2){const r=await api(`/symbols/search?q=${encodeURIComponent(q)}&limit=30`);setSymResults(r);}else setSymResults([]);}} />
              </div>
              <table className="w-full text-sm"><thead><tr className="text-slate-500 text-xs border-b border-slate-700"><th className="text-left py-1">Symbol</th><th className="text-left">Name</th><th>Exchange</th><th>Type</th></tr></thead>
              <tbody>{symResults.map((s,i) => (
                <tr key={i} className="border-b border-slate-800">
                  <td className="py-1 font-semibold">{s.symbol}</td>
                  <td className="text-slate-400 text-xs">{s.name}</td>
                  <td className="text-center"><span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded">{s.exchange}</span></td>
                  <td className="text-center text-xs text-slate-400">{s.type}</td>
                </tr>
              ))}</tbody></table>
              {symQuery.length>=2 && !symResults.length && <div className="text-center text-slate-500 py-4">No matches — download symbols first</div>}
            </div>
          </div>
        )}

        {/* ─── SETTINGS ─── */}
        {tab === "settings" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={card}>
              <div className="text-sm font-semibold mb-3">📱 Telegram Bot</div>
              <p className="text-xs text-slate-500 mb-3">1. Create bot via @BotFather → copy token<br/>2. Start your bot → get Chat ID from @userinfobot</p>
              <div className="flex flex-col gap-2">
                <input className={inp} placeholder={settings.tg_token ? "***saved***" : "Bot Token (123456:ABC...)"} onChange={e=>setSettings({...settings,tg_token:e.target.value})} />
                <input className={inp} placeholder="Chat ID (e.g. 123456789)" defaultValue={settings.tg_chat_id??""} onChange={e=>setSettings({...settings,tg_chat_id:e.target.value})} />
                <div className="flex gap-2">
                  <button className={btn("bg-blue-600 text-white flex-1")} onClick={async()=>{await api("/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(settings)});alert("Saved!");}}>Save</button>
                  <button className={btn("bg-slate-600 text-white")} onClick={async()=>{const r=await api("/telegram/webhook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({})});alert(r.message||r.error||"Done");}}>Set Webhook</button>
                </div>
              </div>
            </div>
            <div className={card}>
              <div className="text-sm font-semibold mb-3">🤖 AI Providers</div>
              <p className="text-xs text-slate-500 mb-3">Add keys for AI features. Free tiers available on all providers.</p>
              {aiStatus?.providers.map(p => (
                <div key={p.name} className="flex items-center justify-between border-b border-slate-700 py-1.5 text-sm">
                  <span className="capitalize font-semibold">{p.name}</span>
                  <span className={p.configured ? "text-green-400 text-xs" : "text-slate-500 text-xs"}>{p.configured ? "✓ Configured" : "Not set"}</span>
                </div>
              ))}
              <p className="text-xs text-slate-600 mt-2">Add these in Coolify → app + worker → Environment Variables: GROQ_API_KEY, CEREBRAS_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY</p>
            </div>
          </div>
        )}
      </div>

      {/* AI result floating panel */}
      {aiTitle && (
        <div className="fixed bottom-4 right-4 w-[min(440px,92vw)] max-h-[60vh] overflow-y-auto bg-slate-800 border border-blue-700 rounded-xl p-4 shadow-2xl z-50">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-blue-300">🤖 {aiTitle}</span>
            <button className="text-slate-400 hover:text-white" onClick={()=>{setAiTitle("");setAiText("");}}>✕</button>
          </div>
          <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{aiBusy ? "Thinking…" : aiText}</div>
        </div>
      )}
    </div>
  );
}

// Inline SIP transaction logger (per-SIP)
function SipTx({ sipId, onAdd, api, inp, btn, fmt }: {
  sipId: number; onAdd: () => void; api: (p: string, o?: RequestInit) => Promise<Record<string, unknown>>;
  inp: string; btn: (c: string) => string; fmt: (n: number | null | undefined) => string;
}) {
  const [open, setOpen] = useState(false);
  const [txs, setTxs] = useState<{ id: number; transaction_date: string; amount: number; units: number; nav: number }[]>([]);
  const [d, setD] = useState(""); const [a, setA] = useState(""); const [u, setU] = useState(""); const [n, setN] = useState("");
  const load = async () => { const r = await api(`/sip/${sipId}/transactions`); setTxs(Array.isArray(r) ? (r as unknown as typeof txs) : []); };
  return (
    <details className="mt-3" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) { setOpen(true); load(); } }}>
      <summary className="cursor-pointer text-slate-400 text-sm">Add instalment / history</summary>
      {open && (
        <div className="mt-2">
          <div className="flex gap-2 flex-wrap mb-2">
            <input className={`${inp} max-w-[150px]`} type="date" value={d} onChange={e=>setD(e.target.value)} />
            <input className={`${inp} max-w-[110px]`} type="number" placeholder="Amount" value={a} onChange={e=>setA(e.target.value)} />
            <input className={`${inp} max-w-[90px]`} type="number" placeholder="Units" value={u} onChange={e=>setU(e.target.value)} />
            <input className={`${inp} max-w-[100px]`} type="number" placeholder="NAV" value={n} onChange={e=>setN(e.target.value)} />
            <button className={btn("bg-green-600 text-white")} onClick={async()=>{
              if(!d||!a||!u||!n)return;
              await api(`/sip/${sipId}/transactions`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({transaction_date:d,amount:+a,units:+u,nav:+n})});
              setD("");setA("");setU("");setN("");await load();onAdd();
            }}>Add</button>
          </div>
          {txs.map(t => (
            <div key={t.id} className="flex justify-between text-xs border-b border-slate-700 py-1">
              <span>{t.transaction_date}</span><span>₹{fmt(t.amount)}</span><span>{t.units} units</span><span>NAV ₹{fmt(t.nav)}</span>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
