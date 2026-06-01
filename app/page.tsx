"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  LayoutDashboard, Eye, TrendingUp, Target, Activity, BookOpen,
  Search, Newspaper, Bell, Clock, Layers, FileText, Wifi,
  Database, Settings2, Zap, ChevronDown, ChevronUp, X, Plus,
  RefreshCw, Download, BarChart2, History, AlertTriangle,
  CheckCircle2, Circle, Loader2, Copy, ExternalLink,
  Sparkles, Send, Calculator, StickyNote, MoreHorizontal,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────
const api = (p: string, o: RequestInit = {}) =>
  fetch("/api" + p, o).then(r => r.json()).catch(() => ({}));
const fmt = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const fmtPct = (n: number | null | undefined) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`;
const cc = (n: number | null | undefined) =>
  !n ? "text-slate-400" : n > 0 ? "text-green-400" : "text-red-400";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// Page type defined above with MobileNav

// ─── shared style tokens (CSS-variable aware for theming) ─────────────────────
const inp = "bg-[var(--bg-panel)] border border-[var(--bd-s)] rounded-md px-3 py-1.5 text-[var(--fg)] text-sm w-full focus:outline-none focus:border-green-500/60";
const btn = (c: string) => `px-3 py-1.5 rounded-md text-sm font-semibold cursor-pointer border-none whitespace-nowrap ${c}`;
const card = "bg-[var(--bg-card)] border border-[var(--bd-s)] rounded-xl p-4";
const th = "text-xs text-[var(--fg-d)] font-medium text-left py-1.5 px-2";
const td = "py-1.5 px-2 text-sm border-b border-[var(--bd)]";

// ─── SymbolCombobox ────────────────────────────────────────────────────────────
interface SymRes { symbol: string; baseSymbol: string; name: string; exchange: string; type: string }

function SymbolCombobox({ value, exchange, onChange, onSelect, placeholder, className }: {
  value: string; exchange?: string;
  onChange: (v: string) => void;
  onSelect: (sym: string, ex: string) => void;
  placeholder?: string; className?: string;
}) {
  const [results, setResults] = useState<SymRes[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback((q: string) => {
    clearTimeout(timer.current);
    if (q.length < 1) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/symbols/search?q=${encodeURIComponent(q)}&exchange=${exchange ?? ""}&limit=8`)
        .then(r => r.json()).catch(() => []);
      setResults(Array.isArray(r) ? r : []);
      setOpen(true);
    }, 180);
  }, [exchange]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <input className={inp} value={value}
        onChange={e => { onChange(e.target.value.toUpperCase()); search(e.target.value); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onFocus={() => value.length >= 1 && search(value)}
        placeholder={placeholder ?? "Symbol"} autoComplete="off" />
      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[#1e293b] border border-[#334155] rounded-lg shadow-2xl max-h-52 overflow-y-auto">
          {results.map(r => (
            <div key={`${r.baseSymbol}:${r.exchange}`}
              className="px-3 py-2 hover:bg-[#334155] cursor-pointer flex justify-between items-center"
              onMouseDown={() => { onSelect(r.baseSymbol, r.exchange); onChange(r.baseSymbol); setOpen(false); }}>
              <span className="font-semibold text-sm">{r.baseSymbol}</span>
              <span className="text-slate-400 text-xs">{r.name.slice(0, 22)} · {r.exchange}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────
function AiPanel({ title, text, busy, onClose }: {
  title: string; text: string; busy: boolean; onClose: () => void;
}) {
  if (!title && !busy) return null;
  return (
    <div className="fixed bottom-8 right-4 w-[420px] max-h-[70vh] bg-[#1e293b] border border-[#334155] rounded-xl shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#334155]">
        <span className="text-sm font-semibold text-green-400">🤖 {title}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={14}/></button>
      </div>
      <div className="overflow-y-auto flex-1 px-4 py-3 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
        {busy ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin"/>Thinking…</span> : text}
      </div>
    </div>
  );
}

// ─── SipTx inline ─────────────────────────────────────────────────────────────
function SipTx({ sipId, onAdd }: { sipId: number; onAdd: () => void }) {
  const [txDate, setTxDate] = useState(today());
  const [units, setUnits] = useState(""); const [nav, setNav] = useState("");
  const [txs, setTxs] = useState<Record<string,unknown>[]>([]);
  const [open, setOpen] = useState(false);
  const load = async () => { const r = await api(`/sip/${sipId}/transactions`); setTxs(Array.isArray(r)?r:[]); };
  return (
    <div className="mt-3 border-t border-[#334155] pt-3">
      <button className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1" onClick={()=>{setOpen(!open);if(!open)load();}}>
        {open ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} Instalments
      </button>
      {open && (
        <div className="mt-2">
          <div className="flex gap-2 mb-2 flex-wrap">
            <input className={`${inp} max-w-[130px] text-xs`} type="date" value={txDate} onChange={e=>setTxDate(e.target.value)}/>
            <input className={`${inp} max-w-[80px] text-xs`} placeholder="Units" value={units} onChange={e=>setUnits(e.target.value)}/>
            <input className={`${inp} max-w-[80px] text-xs`} placeholder="NAV ₹" value={nav} onChange={e=>setNav(e.target.value)}/>
            <button className={btn("bg-green-700 text-white text-xs")} onClick={async()=>{
              if(!units||!nav)return;
              await api(`/sip/${sipId}/transactions`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tx_date:txDate,units:+units,nav_price:+nav})});
              setUnits("");setNav("");load();onAdd();
            }}>+ Add</button>
          </div>
          {txs.map((t:Record<string,unknown>)=>(
            <div key={String(t.id)} className="text-xs text-slate-400 flex justify-between py-0.5">
              <span>{String(t.tx_date)}</span><span>{String(t.units)} units @ ₹{fmt(Number(t.nav_price))}</span>
              <button className="text-red-400" onClick={async()=>{await api(`/sip/${sipId}/transactions`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id})});load();onAdd();}}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Nav items definition ──────────────────────────────────────────────────────
const NAV_MAIN: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard",    label: "Dashboard",     icon: <LayoutDashboard size={14}/> },
  { id: "watchlist",    label: "Watchlist",      icon: <Eye size={14}/> },
  { id: "portfolio",    label: "Portfolio",      icon: <TrendingUp size={14}/> },
  { id: "sip",          label: "SIP Tracker",    icon: <Target size={14}/> },
  { id: "intraday",     label: "Intraday",       icon: <Activity size={14}/> },
  { id: "journal",      label: "Journal",        icon: <BookOpen size={14}/> },
  { id: "screener",     label: "Screener",       icon: <Search size={14}/> },
  { id: "news",         label: "News",           icon: <Newspaper size={14}/> },
  { id: "alerts",       label: "Alerts",         icon: <Bell size={14}/> },
  { id: "alert-history",label: "Alert History",  icon: <History size={14}/> },
  { id: "options",      label: "Options",        icon: <Layers size={14}/> },
  { id: "filings",      label: "Filings",        icon: <FileText size={14}/> },
];
const NAV_BOTTOM: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "brokers",  label: "Brokers",  icon: <Wifi size={14}/> },
  { id: "symbols",  label: "Symbols",  icon: <Database size={14}/> },
  { id: "settings", label: "Settings", icon: <Settings2 size={14}/> },
];

// ─── Risk Calculator ──────────────────────────────────────────────────────────
function RiskCalc({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [capital, setCapital] = useState("100000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState(""); const [sl, setSl] = useState(""); const [target, setTarget] = useState("");
  const cap = Number(capital) || 0, rPct = Number(riskPct) || 1;
  const ent = Number(entry) || 0, slP = Number(sl) || 0, tgt = Number(target) || 0;
  const maxRisk = cap * rPct / 100;
  const slPct = ent && slP ? Math.abs((slP - ent) / ent * 100) : 0;
  const qty = ent && slP ? Math.floor(maxRisk / Math.abs(ent - slP)) : 0;
  const posSize = qty * ent;
  const rr = ent && slP && tgt ? Math.abs(tgt - ent) / Math.abs(slP - ent) : 0;
  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-[var(--bg-card)] border-l border-[var(--bd-s)] shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--bd-s)] shrink-0">
        <span className="text-sm font-semibold flex items-center gap-2"><Calculator size={14} className="text-amber-400"/>Risk Calculator <span className="text-[10px] text-[var(--fg-d)]">Press R</span></span>
        <button onClick={onClose} className="text-[var(--fg-m)] hover:text-[var(--fg)]"><X size={14}/></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div><label className="text-xs text-[var(--fg-d)] mb-1 block">Capital (₹)</label><input className={inp} type="number" value={capital} onChange={e=>setCapital(e.target.value)}/></div>
        <div>
          <label className="text-xs text-[var(--fg-d)] mb-1 block">Risk %</label>
          <input className={inp} type="number" step="0.1" value={riskPct} onChange={e=>setRiskPct(e.target.value)}/>
          <div className="text-xs text-amber-400 mt-1 tabular-nums">Max risk: ₹{fmt(maxRisk)}</div>
        </div>
        <div className="border-t border-[var(--bd)] pt-3">
          <div className="text-xs text-[var(--fg-d)] mb-2">Trade Parameters</div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-[10px] text-[var(--fg-d)] block mb-1">Entry ₹</label><input className={inp} type="number" value={entry} onChange={e=>setEntry(e.target.value)}/></div>
            <div><label className="text-[10px] text-[var(--fg-d)] block mb-1">Stop Loss ₹</label><input className={inp} type="number" value={sl} onChange={e=>setSl(e.target.value)}/></div>
            <div><label className="text-[10px] text-[var(--fg-d)] block mb-1">Target ₹</label><input className={inp} type="number" value={target} onChange={e=>setTarget(e.target.value)}/></div>
          </div>
        </div>
        {ent > 0 && slP > 0 && (
          <div className="bg-[var(--bg-panel)] rounded-lg p-3 space-y-2 text-sm">
            {[
              ["Quantity", `${qty} shares`, ""],
              ["Position Size", `₹${fmt(posSize)}`, ""],
              ["Capital Used", `${cap?(posSize/cap*100).toFixed(1):0}%`, ""],
              ["SL %", `${slPct.toFixed(2)}%`, "text-red-400"],
              ...(tgt > 0 ? [["R:R Ratio", `1:${rr.toFixed(2)}`, rr>=2?"text-green-400":rr>=1?"text-amber-400":"text-red-400"]] : []),
            ].map(([label, val, cls]) => (
              <div key={String(label)} className="flex justify-between">
                <span className="text-[var(--fg-m)]">{label}</span>
                <span className={`font-bold tabular-nums ${cls}`}>{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quick Notepad ────────────────────────────────────────────────────────────
function QuickNotepad({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState(() => { try { return localStorage.getItem("bingo_notepad") ?? ""; } catch { return ""; } });
  const [saved, setSaved] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 120 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { try { const p = localStorage.getItem("bingo_np"); if (p) setPos(JSON.parse(p)); } catch {} }, []);
  const onChange = (v: string) => {
    setText(v); clearTimeout(timer.current);
    timer.current = setTimeout(() => { try { localStorage.setItem("bingo_notepad", v); setSaved(true); setTimeout(()=>setSaved(false),1500); } catch {} }, 400);
  };
  const onMD = (e: React.MouseEvent) => { setDragging(true); drag.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }; };
  useEffect(() => {
    if (!dragging) return;
    const mv = (e: MouseEvent) => setPos({ x: Math.max(0,drag.current.px+e.clientX-drag.current.mx), y: Math.max(0,drag.current.py+e.clientY-drag.current.my) });
    const up = () => { setDragging(false); try { localStorage.setItem("bingo_np", JSON.stringify(pos)); } catch {} };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, [dragging, pos]);
  if (!open) return null;
  return (
    <div style={{ position:"fixed", left:pos.x, top:pos.y, zIndex:60 }} className="w-72 bg-[var(--bg-card)] border border-[var(--bd-s)] rounded-xl shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--bd-s)] cursor-move select-none" onMouseDown={onMD}>
        <span className="text-xs font-semibold text-[var(--fg-m)] flex items-center gap-1.5"><StickyNote size={11}/>Notepad <span className="text-[10px] text-[var(--fg-d)]">Ctrl+Shift+N</span></span>
        <div className="flex items-center gap-1.5">{saved && <CheckCircle2 size={11} className="text-green-400"/>}<button onClick={onClose} className="text-[var(--fg-d)] hover:text-[var(--fg)]"><X size={11}/></button></div>
      </div>
      <textarea className="bg-transparent text-sm text-[var(--fg)] p-3 resize-none focus:outline-none font-mono h-44 placeholder:text-[var(--fg-d)]"
        placeholder="Quick notes…" value={text} onChange={e=>onChange(e.target.value)}/>
    </div>
  );
}

// ─── AI Chat Panel ────────────────────────────────────────────────────────────
function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<{role:"user"|"ai";text:string}[]>([
    { role:"ai", text:"Hi! Ask me about markets, your portfolio, or any stock.\n\nTry: 'Market overview', 'Portfolio analysis', 'Trade ideas', or a stock symbol like RELIANCE." }
  ]);
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);
  const send = async (q?: string) => {
    const text = (q ?? input).trim(); if (!text || busy) return;
    setInput(""); setMsgs(m => [...m, { role:"user", text }]); setBusy(true);
    const lq = text.toLowerCase();
    let path = "/ai/market-summary", body: unknown = undefined;
    if (lq.includes("risk")||lq.includes("score")) { path="/ai/risk-score"; body={}; }
    else if (lq.includes("trade idea")||lq.includes("idea")) { path="/ai/trade-ideas"; body={topGainers:[]}; }
    else if (lq.includes("portfolio")||lq.includes("analys")) { path="/ai/portfolio-analysis"; body={holdings:[]}; }
    else if (lq.includes("journal")) { path="/ai/journal-analysis"; body={}; }
    else if (/^[A-Z]{2,10}$/.test(text.split(" ")[0])) path=`/ai/stock-research?symbol=${text.split(" ")[0].toUpperCase()}`;
    const r = body !== undefined
      ? await fetch("/api"+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(x=>x.json()).catch(()=>({}))
      : await fetch("/api"+path).then(x=>x.json()).catch(()=>({}));
    const out = r.summary||r.analysis||r.research||r.plan||r.insight||
      (r.ideas?r.ideas.map((x:unknown)=>`• ${x}`).join("\n"):"")||
      r.error||"No response.";
    setMsgs(m => [...m, { role:"ai", text: out+(r.provider?`\n\n— ${r.provider}`:"") }]);
    setBusy(false);
  };
  if (!open) return null;
  return (
    <div className="fixed bottom-8 right-4 w-[380px] h-[520px] bg-[var(--bg-card)] border border-[var(--bd-s)] rounded-xl shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--bd-s)] shrink-0">
        <span className="text-sm font-semibold text-green-400 flex items-center gap-1.5"><Sparkles size={13}/>AI Assistant</span>
        <div className="flex gap-2">
          <button onClick={()=>setMsgs([{role:"ai",text:"Chat cleared."}])} className="text-[var(--fg-d)] hover:text-[var(--fg)] text-xs">Clear</button>
          <button onClick={onClose} className="text-[var(--fg-m)] hover:text-[var(--fg)]"><X size={14}/></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.map((m,i)=>(
          <div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
            <div className={`max-w-[88%] text-sm rounded-xl px-3 py-2 whitespace-pre-wrap leading-relaxed ${m.role==="user"?"bg-green-700/60 text-green-100":"bg-[var(--bg-panel)] text-[var(--fg-m)]"}`}>{m.text}</div>
          </div>
        ))}
        {busy&&<div className="flex"><div className="bg-[var(--bg-panel)] text-[var(--fg-d)] text-sm rounded-xl px-3 py-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin"/>Thinking…</div></div>}
        <div ref={bottomRef}/>
      </div>
      <div className="border-t border-[var(--bd-s)] p-3 shrink-0 space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {["Market overview","Portfolio","Trade ideas","Risk score"].map(q=>(
            <button key={q} onClick={()=>send(q)} className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-panel)] text-[var(--fg-d)] hover:text-[var(--fg)]">{q}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="flex-1 bg-[var(--bg-panel)] border border-[var(--bd-s)] rounded-lg px-3 py-1.5 text-sm text-[var(--fg)] focus:outline-none focus:border-green-500/60"
            placeholder="Ask anything…" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}/>
          <button onClick={()=>send()} disabled={busy||!input.trim()} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded-lg text-white">
            <Send size={14}/>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile Nav ───────────────────────────────────────────────────────────────
type Page = "dashboard"|"watchlist"|"portfolio"|"sip"|"intraday"|"journal"|"screener"|"news"|"alerts"|"alert-history"|"options"|"filings"|"brokers"|"symbols"|"settings";
function MobileNav({ page, go, onMore }: { page: Page; go: (p:Page)=>void; onMore: ()=>void }) {
  const tabs: {id:Page;icon:React.ReactNode;label:string}[] = [
    {id:"dashboard",icon:<LayoutDashboard size={18}/>,label:"Home"},
    {id:"watchlist",icon:<Eye size={18}/>,label:"Watch"},
    {id:"portfolio",icon:<TrendingUp size={18}/>,label:"Portfolio"},
    {id:"alerts",icon:<Bell size={18}/>,label:"Alerts"},
    {id:"journal",icon:<BookOpen size={18}/>,label:"Journal"},
  ];
  return (
    <div className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-panel)] border-t border-[var(--bd-s)]">
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>go(t.id)} className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] transition-colors ${page===t.id?"text-green-400":"text-[var(--fg-d)]"}`}>
          {t.icon}{t.label}
        </button>
      ))}
      <button onClick={onMore} className="flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] text-[var(--fg-d)]">
        <MoreHorizontal size={18}/>More
      </button>
    </div>
  );
}
function MobileDrawer({ open, page, go, onClose }: { open:boolean; page:Page; go:(p:Page)=>void; onClose:()=>void }) {
  const items: {id:Page;icon:React.ReactNode;label:string}[] = [
    {id:"screener",icon:<Search size={14}/>,label:"Screener"},
    {id:"intraday",icon:<Activity size={14}/>,label:"Intraday"},
    {id:"sip",icon:<Target size={14}/>,label:"SIP"},
    {id:"news",icon:<Newspaper size={14}/>,label:"News"},
    {id:"alert-history",icon:<History size={14}/>,label:"History"},
    {id:"options",icon:<Layers size={14}/>,label:"Options"},
    {id:"filings",icon:<FileText size={14}/>,label:"Filings"},
    {id:"brokers",icon:<Wifi size={14}/>,label:"Brokers"},
    {id:"symbols",icon:<Database size={14}/>,label:"Symbols"},
    {id:"settings",icon:<Settings2 size={14}/>,label:"Settings"},
  ];
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose}/>
      <div className="fixed bottom-14 left-0 right-0 z-50 bg-[var(--bg-card)] border-t border-[var(--bd-s)] rounded-t-2xl p-4 md:hidden">
        <div className="w-10 h-1 bg-[var(--bd-s)] rounded-full mx-auto mb-4"/>
        <div className="grid grid-cols-5 gap-2">
          {items.map(item=>(
            <button key={item.id} onClick={()=>{go(item.id);onClose();}} className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[11px] transition-colors ${page===item.id?"bg-green-500/15 text-green-400":"text-[var(--fg-d)] hover:text-[var(--fg)] hover:bg-white/5"}`}>
              {item.icon}{item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [page, setPage] = useState<Page>("dashboard");
  const [mktStatus, setMktStatus] = useState<{ isOpen: boolean; message: string; dayName: string; appActive?: boolean; appReason?: string } | null>(null);
  const [indices, setIndices] = useState<{ name: string; exchange: string; ltp: number; changePercent: number }[]>([]);
  const [nifty50, setNifty50] = useState<{ symbol: string; name: string; sector: string; ltp: number; changePercent: number }[]>([]);
  const [fiiDii, setFiiDii] = useState<{ date: string; fiiNetEquity: number; diiNetEquity: number }[]>([]);
  const [breadth, setBreadth] = useState<{ advances: number; declines: number; unchanged: number; total: number } | null>(null);
  const [news, setNews] = useState<{ title: string; link: string; pubDate: string; source: string }[]>([]);
  const [portfolio, setPortfolio] = useState<{ holdings: Record<string,unknown>[]; summary: Record<string,number> } | null>(null);
  const [watchlist, setWatchlist] = useState<{ id: number; symbol: string; exchange: string; ltp?: number; changePercent?: number }[]>([]);
  const [alerts, setAlerts] = useState<Record<string,unknown>[]>([]);
  const [alertHistory, setAlertHistory] = useState<Record<string,unknown>[]>([]);
  const [journal, setJournal] = useState<Record<string,unknown>[]>([]);
  const [intraday, setIntraday] = useState<{ date: string; trades: Record<string,unknown>[] } | null>(null);
  const [intradaySummary, setIntradaySummary] = useState<{ totalPnl: number; totalTrades: number; winRate: number; perSymbol: Record<string,unknown>[] } | null>(null);
  const [screener, setScreener] = useState<Record<string,unknown>[]>([]);
  const [sectorRot, setSectorRot] = useState<{ sector: string; avgChangePct: number; advancers: number; decliners: number }[]>([]);
  const [options, setOptions] = useState<Record<string,unknown> | null>(null);
  const [settings, setSettings] = useState<Record<string,string>>({});
  const [aiStatus, setAiStatus] = useState<{ providers: { name: string; configured: boolean }[] } | null>(null);
  const [sips, setSips] = useState<{ id: number; name: string; symbol: string; frequency: string; amount: number }[]>([]);
  const [sipPerf, setSipPerf] = useState<Record<number, { xirr: number|null; invested: number; units: number; currentValue: number }>>({});
  const [filings, setFilings] = useState<{ id: number; exchange: string; symbol?: string; company?: string; category?: string; subject?: string; attachment?: string; createdAt: string }[]>([]);
  const [symStatus, setSymStatus] = useState<{ total: number; byExchange: Record<string,number>; status?: { state?: string } } | null>(null);
  const [streamStatus, setStreamStatus] = useState<{ iciciConnected: boolean; fyersConnected: boolean; streaming: boolean; source?: string; lastTickAgeSec?: number|null } | null>(null);

  // overlay panels
  const [riskOpen, setRiskOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  // theme
  const [theme, setTheme] = useState<"dark"|"light"|"sepia">("dark");
  // portfolio category
  const [pCat, setPCat] = useState("equity");
  const [pTag, setPTag] = useState("");

  // broker state
  const [iciciStatus, setIciciStatus] = useState<{ connected: boolean; userName?: string; hasSecret?: boolean } | null>(null);
  const [fyersStatus, setFyersStatus] = useState<{ connected: boolean; uid?: string } | null>(null);
  const [iciKey, setIciKey] = useState(""); const [iciSecret, setIciSecret] = useState(""); const [iciToken, setIciToken] = useState("");
  const [fyAppId, setFyAppId] = useState(""); const [fySecret, setFySecret] = useState(""); const [fyRedirect, setFyRedirect] = useState("");

  // form state — portfolio
  const [pSym, setPSym] = useState(""); const [pEx, setPEx] = useState("NSE");
  const [pQty, setPQty] = useState(""); const [pAvg, setPAvg] = useState("");
  const [pDate, setPDate] = useState(""); const [pNotes, setPNotes] = useState("");
  // form — watchlist
  const [wlSym, setWlSym] = useState(""); const [wlEx, setWlEx] = useState("NSE");
  // form — alerts
  const [alSym, setAlSym] = useState(""); const [alEx, setAlEx] = useState("NSE");
  const [alCond, setAlCond] = useState(">"); const [alPrice, setAlPrice] = useState("");
  const [alType, setAlType] = useState("once"); const [alNote, setAlNote] = useState("");
  // form — journal
  const [jDate, setJDate] = useState(today()); const [jSym, setJSym] = useState("");
  const [jDir, setJDir] = useState("BUY"); const [jQty, setJQty] = useState("");
  const [jEntry, setJEntry] = useState(""); const [jExit, setJExit] = useState("");
  const [jSetup, setJSetup] = useState(""); const [jEmotion, setJEmotion] = useState("");
  const [jNotes, setJNotes] = useState(""); const [journalNote, setJournalNote] = useState(""); const [jnDate, setJnDate] = useState(today());
  // form — intraday
  const [idDate, setIdDate] = useState(today()); const [idSym, setIdSym] = useState("");
  const [idSide, setIdSide] = useState("BUY"); const [idQty, setIdQty] = useState(""); const [idPrice, setIdPrice] = useState("");
  // form — options
  const [optSym, setOptSym] = useState("NIFTY");
  // form — screener
  const [screenerType, setScreenerType] = useState("gainers");
  // form — SIP
  const [sipName, setSipName] = useState(""); const [sipSym, setSipSym] = useState("");
  const [sipFreq, setSipFreq] = useState("monthly"); const [sipAmt, setSipAmt] = useState("");
  // settings
  const [settingsForm, setSettingsForm] = useState<Record<string,string>>({});
  const [settingsSaved, setSettingsSaved] = useState(false);
  // AI panel
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState(""); const [aiTitle, setAiTitle] = useState("");
  // symbol download
  const [symDownloading, setSymDownloading] = useState(false);
  const [symQuery, setSymQuery] = useState(""); const [symResults, setSymResults] = useState<SymRes[]>([]);

  // ── data loaders ────────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    const [s, i, n, b, fd] = await Promise.all([
      api("/market/status"), api("/market/indices"), api("/market/nifty50"),
      api("/market/breadth"), api("/market/fii-dii"),
    ]);
    setMktStatus(s); setIndices(Array.isArray(i)?i:[]); setNifty50(Array.isArray(n)?n:[]);
    setBreadth(b); setFiiDii(fd?.data ?? []);
  }, []);

  const loadWatchlist = useCallback(async () => {
    const r = await api("/watchlist");
    setWatchlist(Array.isArray(r) ? r : []);
  }, []);

  const loadPortfolio = useCallback(async () => {
    const r = await api("/portfolio/pnl");
    setPortfolio(r);
  }, []);

  const loadSips = useCallback(async () => {
    const list = await api("/sip");
    setSips(Array.isArray(list) ? list : []);
    const perf: typeof sipPerf = {};
    await Promise.all((Array.isArray(list)?list:[]).map(async (s:{id:number}) => { perf[s.id] = await api(`/sip/${s.id}/performance`); }));
    setSipPerf(perf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBrokers = useCallback(async () => {
    const [ic, fy, saved] = await Promise.all([api("/broker/icici/status"), api("/broker/fyers/status"), api("/broker/icici/saved-key")]);
    setIciciStatus({ ...ic, hasSecret: saved.hasSecret }); setFyersStatus(fy);
    if (saved.apiKey) setIciKey(saved.apiKey);
  }, []);

  const refreshBrokers = useCallback(async () => {
    const [ic, fy] = await Promise.all([api("/broker/icici/status"), api("/broker/fyers/status")]);
    setIciciStatus(ic); setFyersStatus(fy);
  }, []);

  const loadStreamStatus = useCallback(async () => {
    const r = await api("/broker/stream-status");
    setStreamStatus(r);
  }, []);

  // ── AI runner ────────────────────────────────────────────────────────────────
  const runAI = async (title: string, path: string, body?: unknown) => {
    setAiBusy(true); setAiTitle(title); setAiText("Thinking…");
    const r = body !== undefined
      ? await api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await api(path);
    setAiBusy(false);
    if (r.error) { setAiText("⚠️ " + (r.error ?? "AI unavailable — add GROQ_API_KEY in Coolify settings.")); return; }
    const out = r.summary || r.analysis || r.research || r.plan || r.insight ||
      (r.ideas ? r.ideas.map((x:unknown)=>`• ${x}`).join("\n") : "") ||
      (r.overallScore != null ? `Score ${r.overallScore}/100 — ${r.verdict}\n\nRisks:\n${(r.topRisks||[]).map((x:string)=>"• "+x).join("\n")}\n\nActions:\n${(r.suggestedActions||[]).map((x:string)=>"• "+x).join("\n")}` : "") ||
      "No response.";
    setAiText(out + (r.provider ? `\n\n— ${r.provider} / ${r.model}` : ""));
  };

  // ── navigation ───────────────────────────────────────────────────────────────
  const goTo = useCallback(async (p: Page) => {
    setPage(p);
    if (p === "dashboard")    loadDashboard();
    if (p === "watchlist")    loadWatchlist();
    if (p === "portfolio")    loadPortfolio();
    if (p === "sip")          loadSips();
    if (p === "intraday")     { const [tr,sm] = await Promise.all([api(`/intraday?date=${idDate}`), api(`/intraday/summary?date=${idDate}`)]); setIntraday(tr); setIntradaySummary(sm); }
    if (p === "screener")     { const [sc,sr] = await Promise.all([api(`/market/screener?type=${screenerType}`), api("/market/sector-rotation")]); setScreener(Array.isArray(sc)?sc:[]); setSectorRot(Array.isArray(sr)?sr:[]); }
    if (p === "journal")      { const r = await api("/journal"); setJournal(Array.isArray(r)?r:[]); const jn = await api(`/journal/notes?date=${jnDate}`); setJournalNote(jn.content??""); }
    if (p === "news")         { const r = await api("/market/news"); setNews(r.items??[]); }
    if (p === "alerts")       { const [a,h] = await Promise.all([api("/alerts"), api("/alerts/history")]); setAlerts(Array.isArray(a)?a:[]); setAlertHistory(Array.isArray(h)?h:[]); }
    if (p === "alert-history"){ const h = await api("/alerts/history"); setAlertHistory(Array.isArray(h)?h:[]); }
    if (p === "filings")      { const r = await api("/filings"); setFilings(Array.isArray(r)?r:[]); }
    if (p === "brokers")      loadBrokers();
    if (p === "symbols")      { const r = await api("/symbols/status"); setSymStatus(r); }
    if (p === "settings")     { const [s,ai] = await Promise.all([api("/settings"), api("/ai/status")]); setSettings(s); setSettingsForm(s); setAiStatus(ai); }
    if (p === "options")      { const r = await api(`/options?symbol=${optSym}`); setOptions(r); }
  }, [loadDashboard, loadWatchlist, loadPortfolio, loadSips, loadBrokers, screenerType, idDate, jnDate, optSym]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── initial load & auto-refresh ───────────────────────────────────────────
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const t = ((e.data as {type?:string})?.type) || "";
      if (t === "icici_login_complete" || t === "fyers_login_complete") refreshBrokers();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [refreshBrokers]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const tick = async () => {
      const s = await api("/market/status");
      if (cancelled) return;
      setMktStatus(s);
      if (s?.appActive) {
        await loadDashboard();
        if (!timer) timer = setInterval(loadDashboard, 60_000);
      } else {
        await loadDashboard();
        if (timer) { clearInterval(timer); timer = null; }
      }
    };
    tick();
    const guard = setInterval(tick, 5 * 60_000);
    return () => { cancelled = true; if (timer) clearInterval(timer); clearInterval(guard); };
  }, [loadDashboard]);

  // stream status polling
  useEffect(() => {
    loadStreamStatus();
    const t = setInterval(loadStreamStatus, 30_000);
    return () => clearInterval(t);
  }, [loadStreamStatus]);

  // watchlist auto-refresh every 30s (prices come from Redis cache via enriched GET)
  useEffect(() => {
    if (page !== "watchlist") return;
    const t = setInterval(loadWatchlist, 30_000);
    return () => clearInterval(t);
  }, [page, loadWatchlist]);

  // SSE real-time price stream for watchlist
  const wlKey = useMemo(() => watchlist.map(w => `${w.exchange}:${w.symbol}`).sort().join(","), [watchlist.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!wlKey || page !== "watchlist") return;
    const es = new EventSource(`/api/prices/stream?symbols=${wlKey}`);
    es.onmessage = (e) => {
      try {
        const prices = JSON.parse(e.data) as Record<string,{ltp:number;changePercent:number;change:number}>;
        setWatchlist(wl => wl.map(w => { const p = prices[`${w.exchange}:${w.symbol}`]; return p ? {...w,...p} : w; }));
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [page, wlKey]);

  // Theme: restore from localStorage + apply class to <html>
  useEffect(() => {
    try { const t = localStorage.getItem("bingo_theme") as "dark"|"light"|"sepia"|null; if(t) setTheme(t); } catch {}
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-light","theme-sepia");
    if (theme !== "dark") root.classList.add(`theme-${theme}`);
    try { localStorage.setItem("bingo_theme", theme); } catch {}
  }, [theme]);

  // Keyboard shortcuts: R = risk calculator, Ctrl+Shift+N = notepad, Esc = close panels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const editable = ["INPUT","TEXTAREA","SELECT"].includes(tag);
      if (e.key==="r" && !editable && !e.ctrlKey && !e.metaKey) setRiskOpen(o=>!o);
      if (e.key==="n" && e.ctrlKey && e.shiftKey) { e.preventDefault(); setNoteOpen(o=>!o); }
      if (e.key==="Escape") { setRiskOpen(false); setNoteOpen(false); setMobileDrawer(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // current IST time in status bar
  const [nowIST, setNowIST] = useState("");
  useEffect(() => {
    const tick = () => setNowIST(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick(); const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ── nav item renderer ────────────────────────────────────────────────────────
  const NavItem = ({ id, label, icon }: { id: Page; label: string; icon: React.ReactNode }) => {
    const active = page === id;
    return (
      <button onClick={() => goTo(id)}
        className={`relative w-full flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors text-left ${
          active
            ? "text-green-400 bg-green-500/10 font-medium"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        }`}>
        {active && <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-green-500"/>}
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
    );
  };

  // ── page titles ──────────────────────────────────────────────────────────────
  const PAGE_TITLE: Record<Page, string> = {
    dashboard:"Dashboard", watchlist:"Watchlist", portfolio:"Portfolio", sip:"SIP Tracker",
    intraday:"Intraday Log", journal:"Trade Journal", screener:"Screener", news:"Market News",
    alerts:"Alerts", "alert-history":"Alert History", options:"Options Chain",
    filings:"NSE/BSE Filings", brokers:"Broker Connections", symbols:"Symbol Master", settings:"Settings",
  };

  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--bg)] text-[var(--fg)]">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex flex-col w-48 h-full bg-[var(--bg-panel)] border-r border-[var(--bd)] shrink-0">
        {/* logo */}
        <div className="h-12 px-4 flex items-center gap-2.5 border-b border-[var(--bd)] shrink-0">
          <div className="w-6 h-6 bg-green-500 rounded-[4px] flex items-center justify-center shrink-0">
            <Zap size={13} className="text-black fill-black"/>
          </div>
          <span className="text-[13px] font-semibold tracking-tight">Bingo V3.2</span>
        </div>
        {/* nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_MAIN.map(n => <NavItem key={n.id} {...n}/>)}
          <div className="my-2 mx-4 border-t border-[var(--bd)]"/>
          {NAV_BOTTOM.map(n => <NavItem key={n.id} {...n}/>)}
        </nav>
        {/* broker quick status */}
        <div className="border-t border-[var(--bd)] px-4 py-3 text-xs text-[var(--fg-d)] shrink-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${iciciStatus?.connected ? "bg-green-500" : "bg-slate-600"}`}/>
            ICICI {iciciStatus?.connected ? iciciStatus.userName ?? "Connected" : "Offline"}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${fyersStatus?.connected ? "bg-green-500" : "bg-slate-600"}`}/>
            Fyers {fyersStatus?.connected ? fyersStatus.uid ?? "Connected" : "Offline"}
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* top bar */}
        <header className="h-12 bg-[var(--bg-panel)] border-b border-[var(--bd)] px-5 flex items-center justify-between shrink-0">
          <span className="text-[15px] font-semibold">{PAGE_TITLE[page]}</span>
          <div className="flex items-center gap-3">
            {mktStatus?.appActive === false && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
                ⏸ {mktStatus?.appReason === "weekend" ? "Weekend" : mktStatus?.appReason === "nse_holiday" ? "NSE Holiday" : mktStatus?.appReason === "pre_open" ? "Pre-open" : "After close"} — last close
              </span>
            )}
            <span className={`text-xs font-medium flex items-center gap-1.5 px-2 py-1 rounded ${mktStatus?.isOpen ? "bg-green-500/15 text-green-400" : "text-slate-500"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${mktStatus?.isOpen ? "bg-green-400 animate-pulse" : "bg-slate-500"}`}/>
              {mktStatus?.isOpen ? "Market Open" : "Market Closed"}
            </span>
          </div>
        </header>

        {/* page content */}
        <main className="flex-1 overflow-y-auto p-5 pb-20 md:pb-5">

          {/* ─── DASHBOARD ─── */}
          {page === "dashboard" && (
            <div className="space-y-4">
              {/* Indices */}
              <section>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Market Indices</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {indices.map(idx => (
                    <div key={idx.name} className={`${card} text-center`}>
                      <div className="text-xs text-slate-500 mb-0.5">{idx.name}</div>
                      <div className="text-base font-bold tabular-nums">{fmt(idx.ltp)}</div>
                      <div className={`text-xs font-semibold ${cc(idx.changePercent)}`}>{fmtPct(idx.changePercent)}</div>
                    </div>
                  ))}
                  {!indices.length && [...Array(5)].map((_,i)=><div key={i} className={`${card} h-16 animate-pulse`}/>)}
                </div>
              </section>

              {/* AI Market Overview */}
              <section>
                <div className={card}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-300">AI Market Overview</span>
                    <button className={btn("bg-green-700/60 text-green-300 text-xs")} disabled={aiBusy}
                      onClick={()=>runAI("AI Market Summary","/ai/market-summary")}>
                      {aiBusy?<Loader2 size={12} className="animate-spin inline mr-1"/>:"🤖"} Generate
                    </button>
                  </div>
                  {aiTitle === "AI Market Summary" && aiText && (
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{aiText}</p>
                  )}
                </div>
              </section>

              {/* Breadth + FII */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={card}>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Market Breadth</h3>
                  {breadth ? (
                    <>
                      <div className="flex gap-4 mb-3">
                        <div className="text-center flex-1"><div className="text-2xl font-bold text-green-400">{breadth.advances}</div><div className="text-xs text-slate-500">Advances</div></div>
                        <div className="text-center flex-1"><div className="text-2xl font-bold text-red-400">{breadth.declines}</div><div className="text-xs text-slate-500">Declines</div></div>
                        <div className="text-center flex-1"><div className="text-2xl font-bold text-slate-400">{breadth.unchanged}</div><div className="text-xs text-slate-500">Unch</div></div>
                      </div>
                      <div className="text-xs text-slate-500">A/D Ratio: <span className="text-slate-300">{breadth.declines ? (breadth.advances/breadth.declines).toFixed(2) : "—"}</span></div>
                      <div className="mt-2 h-2 rounded-full bg-[#0f172a] overflow-hidden flex">
                        <div className="bg-green-500 h-full" style={{width:`${breadth.total?breadth.advances/breadth.total*100:0}%`}}/>
                        <div className="bg-red-500 h-full" style={{width:`${breadth.total?breadth.declines/breadth.total*100:0}%`}}/>
                      </div>
                    </>
                  ) : <div className="text-slate-500 text-sm">Loading…</div>}
                </div>
                <div className={`${card} md:col-span-2`}>
                  <h3 className="text-xs font-semibold text-[var(--fg-d)] uppercase tracking-wider mb-3">FII / DII Flows (₹ Cr)</h3>
                  {fiiDii.slice(-5).reverse().map(r => {
                    const maxAbs = Math.max(...fiiDii.map(x=>Math.abs(x.fiiNetEquity||0)),1);
                    const fiiW = Math.min(Math.abs(r.fiiNetEquity||0)/maxAbs*100,100);
                    const diiW = Math.min(Math.abs(r.diiNetEquity||0)/maxAbs*100,100);
                    return (
                      <div key={r.date} className="mb-2">
                        <div className="flex justify-between text-[10px] text-[var(--fg-d)] mb-0.5">
                          <span>{r.date}</span>
                          <span className="flex gap-3">
                            <span className={cc(r.fiiNetEquity)}>FII {r.fiiNetEquity>=0?"+":""}{fmt(r.fiiNetEquity)}</span>
                            <span className={cc(r.diiNetEquity)}>DII {r.diiNetEquity>=0?"+":""}{fmt(r.diiNetEquity)}</span>
                          </span>
                        </div>
                        <div className="flex gap-1 h-1.5">
                          <div className="flex-1 bg-[var(--bd)] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${r.fiiNetEquity>=0?"bg-green-500":"bg-red-500"}`} style={{width:`${fiiW}%`}}/>
                          </div>
                          <div className="flex-1 bg-[var(--bd)] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${r.diiNetEquity>=0?"bg-blue-500":"bg-orange-500"}`} style={{width:`${diiW}%`}}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Nifty 50 Heatmap */}
              <section>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nifty 50 Heatmap</h2>
                <div className={card}>
                  <div className="flex flex-wrap gap-1.5">
                    {nifty50.map(s => {
                      const pct = s.changePercent;
                      const i = Math.min(Math.abs(pct)/3, 1);
                      const bg = pct>0 ? `rgba(34,197,94,${0.15+i*0.55})` : pct<0 ? `rgba(239,68,68,${0.15+i*0.55})` : "rgba(100,116,139,0.2)";
                      return (
                        <div key={s.symbol} title={`${s.symbol} ₹${s.ltp} ${pct}%`}
                          style={{background:bg}} className="rounded-md p-1.5 text-center min-w-[68px] cursor-default hover:scale-105 transition-transform">
                          <div className="text-[11px] font-bold leading-tight">{s.symbol}</div>
                          <div className={`text-[11px] font-semibold mt-0.5 ${cc(pct)}`}>{pct>=0?"+":""}{pct.toFixed(1)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ─── WATCHLIST ─── */}
          {page === "watchlist" && (
            <div className="space-y-4">
              <div className={card}>
                <h3 className="text-sm font-semibold mb-3">Add Symbol</h3>
                <div className="flex gap-2 flex-wrap">
                  <SymbolCombobox value={wlSym} exchange={wlEx} onChange={setWlSym} onSelect={(s,ex)=>{setWlSym(s);setWlEx(ex);}} placeholder="Symbol" className="flex-1 min-w-[140px]"/>
                  <select className={`${inp} w-auto`} value={wlEx} onChange={e=>setWlEx(e.target.value)}><option>NSE</option><option>BSE</option></select>
                  <button className={btn("bg-green-600 text-white")} onClick={async()=>{
                    if(!wlSym)return;
                    await api("/watchlist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:wlSym,exchange:wlEx})});
                    setWlSym(""); loadWatchlist();
                  }}><Plus size={14} className="inline mr-1"/>Add</button>
                </div>
              </div>
              <div className={card}>
                <div className="overflow-x-auto">
                  <table className="w-full"><thead><tr className="border-b border-[#334155]">
                    <th className={th}>Symbol</th><th className={th}>Exchange</th><th className={`${th} text-right`}>LTP</th><th className={`${th} text-right`}>Change%</th><th className={th}></th>
                  </tr></thead>
                  <tbody>{watchlist.map(w=>(
                    <tr key={w.id} className="hover:bg-white/[0.02]">
                      <td className={`${td} font-semibold text-green-400`}>{w.symbol}</td>
                      <td className={td}><span className="text-xs bg-[#334155] px-1.5 py-0.5 rounded">{w.exchange}</span></td>
                      <td className={`${td} text-right tabular-nums`}>₹{fmt(w.ltp)}</td>
                      <td className={`${td} text-right tabular-nums ${cc(w.changePercent)}`}>{fmtPct(w.changePercent)}</td>
                      <td className={td}><button className="text-red-400 hover:text-red-300 px-2 text-xs" onClick={async()=>{await api("/watchlist",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:w.id})});loadWatchlist();}}>✕</button></td>
                    </tr>
                  ))}</tbody></table>
                  {!watchlist.length && <p className="text-center text-slate-500 py-8">Watchlist empty — add a symbol above</p>}
                </div>
              </div>
            </div>
          )}

          {/* ─── PORTFOLIO ─── */}
          {page === "portfolio" && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <button className={btn("bg-purple-700 text-white")} disabled={aiBusy} onClick={()=>runAI("Portfolio Risk Score","/ai/risk-score",{})}>🤖 AI Risk Score</button>
                <a className={btn("bg-[#334155] text-slate-200")} href="/api/export?type=portfolio"><Download size={13} className="inline mr-1"/>Export CSV</a>
              </div>
              {portfolio?.summary && (
                <div className={`${card} flex gap-6 flex-wrap`}>
                  {[["Invested","totalInvested"],["Current","totalCurrent"],["P&L","totalPnl"],["Return","totalPnlPercent"],["XIRR","xirr"]].map(([label,key])=>(
                    <div key={key}>
                      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
                      <div className={`text-xl font-bold tabular-nums ${["totalPnl","totalPnlPercent","xirr"].includes(key)?cc(portfolio.summary[key]):""}`}>
                        {key.includes("Percent")||key==="xirr" ? fmtPct(portfolio.summary[key]) : `₹${fmt(portfolio.summary[key])}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className={card}>
                <h3 className="text-sm font-semibold mb-3">Add Holding</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2">
                  <SymbolCombobox value={pSym} exchange={pEx} onChange={setPSym} onSelect={(s,ex)=>{setPSym(s);setPEx(ex);}} className="col-span-2 sm:col-span-1"/>
                  <select className={inp} value={pEx} onChange={e=>setPEx(e.target.value)}><option>NSE</option><option>BSE</option></select>
                  <select className={inp} value={pCat} onChange={e=>setPCat(e.target.value)}>
                    <option value="equity">Equity</option><option value="mf">MF</option><option value="etf">ETF</option>
                    <option value="sgb">SGB</option><option value="fd">FD</option><option value="other">Other</option>
                  </select>
                  <input className={inp} placeholder="Account tag" value={pTag} onChange={e=>setPTag(e.target.value)}/>
                  <input className={inp} type="number" placeholder="Qty" value={pQty} onChange={e=>setPQty(e.target.value)}/>
                  <input className={inp} type="number" placeholder="Avg Price ₹" value={pAvg} onChange={e=>setPAvg(e.target.value)}/>
                  <input className={inp} type="date" value={pDate} onChange={e=>setPDate(e.target.value)}/>
                  <input className={inp} placeholder="Notes" value={pNotes} onChange={e=>setPNotes(e.target.value)}/>
                  <button className={btn("bg-green-600 text-white")} onClick={async()=>{
                    if(!pSym||!pQty||!pAvg){alert("Fill symbol, qty, avg price");return;}
                    await api("/portfolio",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:pSym,exchange:pEx,qty:+pQty,avg_price:+pAvg,buy_date:pDate,category:pCat,account_tag:pTag,notes:pNotes})});
                    loadPortfolio(); setPSym("");setPQty("");setPAvg("");setPTag("");
                  }}>Add</button>
                </div>
              </div>
              <div className={card}>
                <div className="overflow-x-auto">
                  <table className="w-full"><thead><tr className="border-b border-[var(--bd-s)]">
                    <th className={th}>Symbol</th><th className={th}>Cat</th><th className={th}>Sector</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Avg</th><th className={`${th} text-right`}>LTP</th><th className={`${th} text-right`}>Invested</th><th className={`${th} text-right`}>Current</th><th className={`${th} text-right`}>P&L</th><th className={`${th} text-right`}>%</th><th className={`${th} text-right`}>XIRR</th><th className={th}></th>
                  </tr></thead>
                  <tbody>{(portfolio?.holdings??[]).map((h:Record<string,unknown>)=>(
                    <tr key={String(h.id)} className="hover:bg-white/[0.02]">
                      <td className={`${td} font-semibold`}>{String(h.symbol)}<br/><span className="text-[10px] text-[var(--fg-d)]">{String(h.exchange)}</span></td>
                      <td className={td}><span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-400">{String(h.category||"eq")}</span></td>
                      <td className={`${td} text-xs text-[var(--fg-m)]`}>{String(h.sector||"—")}</td>
                      <td className={`${td} text-right tabular-nums`}>{String(h.qty)}</td>
                      <td className={`${td} text-right tabular-nums`}>₹{fmt(Number(h.avg_price))}</td>
                      <td className={`${td} text-right tabular-nums`}>₹{fmt(Number(h.ltp))}</td>
                      <td className={`${td} text-right tabular-nums`}>₹{fmt(Number(h.invested))}</td>
                      <td className={`${td} text-right tabular-nums`}>₹{fmt(Number(h.current))}</td>
                      <td className={`${td} text-right tabular-nums ${cc(Number(h.pnl))}`}>₹{fmt(Number(h.pnl))}</td>
                      <td className={`${td} text-right tabular-nums ${cc(Number(h.pnlPercent))}`}>{fmtPct(Number(h.pnlPercent))}</td>
                      <td className={`${td} text-right text-cyan-400 tabular-nums`}>{h.xirr!=null?`${Number(h.xirr).toFixed(1)}%`:"—"}</td>
                      <td className={td}><button className="text-red-400 hover:text-red-300 px-2 text-xs" onClick={async()=>{await api("/portfolio",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:h.id})});loadPortfolio();}}>✕</button></td>
                    </tr>
                  ))}</tbody></table>
                  {!portfolio?.holdings?.length && <p className="text-center text-slate-500 py-8">No holdings yet</p>}
                </div>
              </div>
            </div>
          )}

          {/* ─── SIP ─── */}
          {page === "sip" && (
            <div className="space-y-4">
              <div className={card}>
                <h3 className="text-sm font-semibold mb-3">Add SIP</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input className={inp} placeholder="Name (e.g. Nifty Index SIP)" value={sipName} onChange={e=>setSipName(e.target.value)}/>
                  <SymbolCombobox value={sipSym} onChange={setSipSym} onSelect={(s)=>setSipSym(s)} placeholder="Fund / Symbol"/>
                  <select className={inp} value={sipFreq} onChange={e=>setSipFreq(e.target.value)}><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="quarterly">Quarterly</option></select>
                  <input className={inp} type="number" placeholder="Amount ₹" value={sipAmt} onChange={e=>setSipAmt(e.target.value)}/>
                  <button className={btn("bg-green-600 text-white")} onClick={async()=>{
                    if(!sipName||!sipSym||!sipAmt){alert("Fill name, symbol, amount");return;}
                    await api("/sip",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:sipName,symbol:sipSym,frequency:sipFreq,amount:+sipAmt})});
                    setSipName("");setSipSym("");setSipAmt(""); loadSips();
                  }}>Add SIP</button>
                </div>
              </div>
              {sips.map(s=>{ const p=sipPerf[s.id]||{xirr:null,invested:0,units:0,currentValue:0}; return (
                <div key={s.id} className={card}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-semibold">{s.name}</span>
                      <span className="ml-2 text-xs bg-[#334155] px-2 py-0.5 rounded">{s.symbol}</span>
                      <span className="ml-1 text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">{s.frequency}</span>
                      <span className="ml-1 text-xs text-slate-500">₹{fmt(s.amount)}/instalment</span>
                    </div>
                    <button className="text-red-400 text-xs hover:text-red-300" onClick={async()=>{if(!confirm("Delete SIP?"))return;await api("/sip",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:s.id})});loadSips();}}>Delete</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><div className="text-xs text-slate-500">Invested</div><b>₹{fmt(p.invested)}</b></div>
                    <div><div className="text-xs text-slate-500">Units</div><b>{p.units}</b></div>
                    <div><div className="text-xs text-slate-500">Current Value</div><b>₹{fmt(p.currentValue)}</b></div>
                    <div><div className="text-xs text-slate-500">XIRR</div><b className={cc(p.xirr??0)}>{p.xirr!=null?`${Number(p.xirr).toFixed(2)}%`:"—"}</b></div>
                  </div>
                  <SipTx sipId={s.id} onAdd={loadSips}/>
                </div>
              );})}
              {!sips.length && <p className="text-center text-slate-500 py-10">No SIPs yet — add one above and log each instalment to track XIRR</p>}
            </div>
          )}

          {/* ─── INTRADAY ─── */}
          {page === "intraday" && (
            <div className="space-y-4">
              <div className={card}>
                <div className="flex gap-2 flex-wrap items-center">
                  <input className={`${inp} max-w-[160px]`} type="date" value={idDate} onChange={e=>setIdDate(e.target.value)}/>
                  <button className={btn("bg-blue-600 text-white")} onClick={async()=>{const [tr,sm]=await Promise.all([api(`/intraday?date=${idDate}`),api(`/intraday/summary?date=${idDate}`)]);setIntraday(tr);setIntradaySummary(sm);}}>Load</button>
                  <a className={btn("bg-[#334155] text-slate-200")} href="/api/export?type=intraday"><Download size={13} className="inline mr-1"/>Export CSV</a>
                  <button className={btn("bg-purple-700 text-white")} disabled={aiBusy} onClick={()=>runAI("Intraday Summary","/ai/intraday-summary",{})}>🤖 AI Summary</button>
                </div>
              </div>
              {intradaySummary && (
                <div className={`${card} flex gap-6 flex-wrap`}>
                  <div><div className="text-xs text-slate-500">Net P&L</div><div className={`text-xl font-bold tabular-nums ${cc(intradaySummary.totalPnl)}`}>₹{fmt(intradaySummary.totalPnl)}</div></div>
                  <div><div className="text-xs text-slate-500">Trades</div><div className="text-xl font-bold">{intradaySummary.totalTrades}</div></div>
                  <div><div className="text-xs text-slate-500">Win Rate</div><div className={`text-xl font-bold ${cc(intradaySummary.winRate-50)}`}>{intradaySummary.winRate}%</div></div>
                </div>
              )}
              {intradaySummary && (intradaySummary.perSymbol??[]).length>0 && (
                <div className={card}>
                  {(intradaySummary.perSymbol).map((s:Record<string,unknown>)=>(
                    <div key={String(s.symbol)} className="flex justify-between items-center text-sm border-b border-[#1e293b] py-1.5">
                      <span className="font-semibold">{String(s.symbol)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${s.status==="Closed"?"bg-green-900/50 text-green-400":s.status==="Open"?"bg-blue-900/50 text-blue-400":"bg-amber-900/50 text-amber-400"}`}>{String(s.status)}</span>
                      <span className={cc(Number(s.realized_pnl))}>₹{fmt(Number(s.realized_pnl))}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className={card}>
                <h3 className="text-sm font-semibold mb-3">Add Trade</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <SymbolCombobox value={idSym} onChange={setIdSym} onSelect={(s)=>setIdSym(s)} placeholder="Symbol"/>
                  <select className={inp} value={idSide} onChange={e=>setIdSide(e.target.value)}><option>BUY</option><option>SELL</option></select>
                  <input className={inp} type="number" placeholder="Qty" value={idQty} onChange={e=>setIdQty(e.target.value)}/>
                  <input className={inp} type="number" placeholder="Price ₹" value={idPrice} onChange={e=>setIdPrice(e.target.value)}/>
                  <button className={btn("bg-green-600 text-white")} onClick={async()=>{
                    if(!idSym||!idQty||!idPrice)return;
                    await api("/intraday",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:idSym,side:idSide,qty:+idQty,price:+idPrice,trade_date:idDate})});
                    const [tr,sm]=await Promise.all([api(`/intraday?date=${idDate}`),api(`/intraday/summary?date=${idDate}`)]);
                    setIntraday(tr);setIntradaySummary(sm);setIdSym("");setIdQty("");setIdPrice("");
                  }}>Add</button>
                </div>
              </div>
              <div className={card}>
                <div className="overflow-x-auto">
                  <table className="w-full"><thead><tr className="border-b border-[#334155]">
                    <th className={th}>Symbol</th><th className={th}>Side</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Price</th><th className={th}>Notes</th><th className={th}></th>
                  </tr></thead>
                  <tbody>{(intraday?.trades??[]).map((t:Record<string,unknown>)=>(
                    <tr key={String(t.id)} className="hover:bg-white/[0.02]">
                      <td className={`${td} font-semibold`}>{String(t.symbol)}</td>
                      <td className={td}><span className={`text-xs px-1.5 py-0.5 rounded font-bold ${t.side==="BUY"?"bg-green-900/50 text-green-400":"bg-red-900/50 text-red-400"}`}>{String(t.side)}</span></td>
                      <td className={`${td} text-right tabular-nums`}>{String(t.qty)}</td>
                      <td className={`${td} text-right tabular-nums`}>₹{fmt(Number(t.price))}</td>
                      <td className={`${td} text-xs text-slate-400`}>{String(t.notes||"")}</td>
                      <td className={td}><button className="text-red-400 text-xs px-2" onClick={async()=>{await api("/intraday",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:t.id})});const [tr,sm]=await Promise.all([api(`/intraday?date=${idDate}`),api(`/intraday/summary?date=${idDate}`)]);setIntraday(tr);setIntradaySummary(sm);}}>✕</button></td>
                    </tr>
                  ))}</tbody></table>
                  {!intraday?.trades?.length && <p className="text-center text-slate-500 py-6">No trades for {idDate}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ─── JOURNAL ─── */}
          {page === "journal" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={card}>
                  <h3 className="text-sm font-semibold mb-3">Log Trade</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inp} type="date" value={jDate} onChange={e=>setJDate(e.target.value)}/>
                    <SymbolCombobox value={jSym} onChange={setJSym} onSelect={(s)=>setJSym(s)} placeholder="Symbol"/>
                    <select className={inp} value={jDir} onChange={e=>setJDir(e.target.value)}><option>BUY</option><option>SELL</option></select>
                    <select className={inp} value={jSetup} onChange={e=>setJSetup(e.target.value)}>
                      <option value="">Setup</option><option>Breakout</option><option>Reversal</option><option>Trend Follow</option><option>Gap Play</option><option>News</option><option>Options</option><option>Scalp</option>
                    </select>
                    <input className={inp} type="number" placeholder="Qty" value={jQty} onChange={e=>setJQty(e.target.value)}/>
                    <input className={inp} type="number" placeholder="Entry ₹" value={jEntry} onChange={e=>setJEntry(e.target.value)}/>
                    <input className={inp} type="number" placeholder="Exit ₹ (optional)" value={jExit} onChange={e=>setJExit(e.target.value)}/>
                    <select className={inp} value={jEmotion} onChange={e=>setJEmotion(e.target.value)}>
                      <option value="">Emotion</option><option>Confident</option><option>Fearful</option><option>FOMO</option><option>Disciplined</option><option>Revenge</option><option>Calm</option>
                    </select>
                  </div>
                  <textarea className={`${inp} mt-2 h-16 resize-none`} placeholder="Notes / learnings…" value={jNotes} onChange={e=>setJNotes(e.target.value)}/>
                  <button className={`${btn("bg-green-600 text-white")} w-full mt-2`} onClick={async()=>{
                    if(!jDate||!jSym||!jQty||!jEntry){alert("Fill date, symbol, qty, entry");return;}
                    await api("/journal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trade_date:jDate,symbol:jSym,direction:jDir,qty:+jQty,entry_price:+jEntry,exit_price:jExit?+jExit:null,setup:jSetup,emotion:jEmotion,notes:jNotes})});
                    const r=await api("/journal");setJournal(r);setJSym("");setJQty("");setJEntry("");setJExit("");setJNotes("");
                  }}>Log Trade</button>
                </div>
                <div className={card}>
                  <h3 className="text-sm font-semibold mb-2">Daily Market Note</h3>
                  <input className={`${inp} mb-2`} type="date" value={jnDate} onChange={async e=>{setJnDate(e.target.value);const r=await api(`/journal/notes?date=${e.target.value}`);setJournalNote(r.content??"");}}/>
                  <textarea className={`${inp} h-32 resize-none`} placeholder="Market thoughts, key observations…" value={journalNote} onChange={e=>setJournalNote(e.target.value)}/>
                  <button className={`${btn("bg-blue-600 text-white")} w-full mt-2`} onClick={async()=>{await api("/journal/notes",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:jnDate,content:journalNote})});}}>Save Note</button>
                </div>
              </div>
              <div className={card}>
                <div className="flex gap-3 items-center mb-3 flex-wrap">
                  <span className="text-sm">Trades: <b>{journal.length}</b></span>
                  <span className={`text-sm ${cc(journal.reduce((s,r)=>s+Number((r as Record<string,unknown>).pnl||0),0))}`}>P&L: <b>₹{fmt(journal.reduce((s,r)=>s+Number((r as Record<string,unknown>).pnl||0),0))}</b></span>
                  <button className={btn("bg-purple-700 text-white")} disabled={aiBusy} onClick={()=>runAI("Journal Analysis","/ai/journal-analysis",{})}>🤖 AI Analysis</button>
                  <a className={btn("bg-[#334155] text-slate-200")} href="/api/export?type=journal"><Download size={13} className="inline mr-1"/>Export CSV</a>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full"><thead><tr className="border-b border-[#334155]">
                    <th className={th}>Date</th><th className={th}>Symbol</th><th className={th}>Dir</th><th className={`${th} text-right`}>Qty</th><th className={`${th} text-right`}>Entry</th><th className={`${th} text-right`}>Exit</th><th className={`${th} text-right`}>P&L</th><th className={th}>Setup</th><th className={th}>Emotion</th><th className={th}></th>
                  </tr></thead>
                  <tbody>{journal.map((r:Record<string,unknown>)=>(
                    <tr key={String(r.id)} className="hover:bg-white/[0.02]">
                      <td className={`${td} text-xs`}>{String(r.trade_date)}</td>
                      <td className={`${td} font-semibold`}>{String(r.symbol)}</td>
                      <td className={td}><span className={`text-xs font-bold ${r.direction==="BUY"?"text-green-400":"text-red-400"}`}>{String(r.direction)}</span></td>
                      <td className={`${td} text-right tabular-nums`}>{String(r.qty)}</td>
                      <td className={`${td} text-right tabular-nums`}>₹{fmt(Number(r.entry_price))}</td>
                      <td className={`${td} text-right tabular-nums`}>{r.exit_price?`₹${fmt(Number(r.exit_price))}`:"—"}</td>
                      <td className={`${td} text-right tabular-nums ${cc(Number(r.pnl))}`}>{r.pnl!=null?`₹${fmt(Number(r.pnl))}`:"—"}</td>
                      <td className={`${td} text-xs text-slate-400`}>{String(r.setup||"")}</td>
                      <td className={`${td} text-xs text-slate-400`}>{String(r.emotion||"")}</td>
                      <td className={td}><button className="text-red-400 text-xs px-2" onClick={async()=>{await api("/journal",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:r.id})});const jr=await api("/journal");setJournal(Array.isArray(jr)?jr:[]);}}>✕</button></td>
                    </tr>
                  ))}</tbody></table>
                  {!journal.length && <p className="text-center text-slate-500 py-6">No journal entries</p>}
                </div>
              </div>
            </div>
          )}

          {/* ─── SCREENER ─── */}
          {page === "screener" && (
            <div className="space-y-4">
              <div className={`${card} flex gap-2 flex-wrap`}>
                {[["gainers","▲ Gainers","bg-green-800"],["losers","▼ Losers","bg-red-800"]].map(([t,l,c])=>(
                  <button key={t} className={btn(`${screenerType===t?c:"bg-[#334155]"} text-white`)}
                    onClick={async()=>{setScreenerType(t);const r=await api(`/market/screener?type=${t}`);setScreener(Array.isArray(r)?r:[]);}}>
                    {l}
                  </button>
                ))}
                <button className={btn("bg-blue-700 text-white")} onClick={async()=>{
                  setScreenerType("52w high");
                  const r=await api("/market/52week");
                  setScreener(((r.nearHigh||[]) as Record<string,unknown>[]).map(s=>({symbol:s.symbol,ltp:s.ltp,change:0,changePercent:s.pChange,volume:0})));
                }}>52W Highs</button>
                <button className={btn("bg-amber-700 text-white")} onClick={async()=>{
                  setScreenerType("volume");
                  const r=await api("/screener/volume-surges?ratio=2");
                  setScreener(((r.rows||[]) as Record<string,unknown>[]).map(s=>({symbol:s.symbol,ltp:s.ltp,change:0,changePercent:s.changePercent,volume:s.volume})));
                }}>Volume Surge</button>
                <button className={btn("bg-purple-700 text-white")} disabled={aiBusy}
                  onClick={()=>runAI("Trade Ideas","/ai/trade-ideas",{topGainers:screener.slice(0,5).map((s:Record<string,unknown>)=>({symbol:s.symbol,changePct:s.changePercent}))})}>
                  🤖 AI Trade Ideas
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={card}>
                  <h3 className="text-sm font-semibold mb-2 capitalize">{screenerType}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full"><thead><tr className="border-b border-[#334155]">
                      <th className={th}>Symbol</th><th className={`${th} text-right`}>LTP</th><th className={`${th} text-right`}>Change</th><th className={`${th} text-right`}>%</th><th className={`${th} text-right`}>Vol</th>
                    </tr></thead>
                    <tbody>{screener.map((s:Record<string,unknown>)=>(
                      <tr key={String(s.symbol)} className="hover:bg-white/[0.02]">
                        <td className={`${td} font-semibold`}>{String(s.symbol)}</td>
                        <td className={`${td} text-right tabular-nums`}>₹{fmt(Number(s.ltp))}</td>
                        <td className={`${td} text-right tabular-nums ${cc(Number(s.change))}`}>₹{fmt(Number(s.change))}</td>
                        <td className={`${td} text-right tabular-nums ${cc(Number(s.changePercent))}`}>{fmtPct(Number(s.changePercent))}</td>
                        <td className={`${td} text-right tabular-nums text-slate-400 text-xs`}>{(Number(s.volume)/100000).toFixed(1)}L</td>
                      </tr>
                    ))}</tbody></table>
                    {!screener.length && <p className="text-center text-slate-500 py-6">Click a button above to load</p>}
                  </div>
                </div>
                <div className={card}>
                  <h3 className="text-sm font-semibold mb-2">Sector Rotation</h3>
                  {sectorRot.map(s=>(
                    <div key={s.sector} className="flex justify-between items-center border-b border-[#1e293b] py-1.5 text-sm">
                      <span className="text-slate-300">{s.sector}</span>
                      <span className={`font-semibold ${cc(s.avgChangePct)}`}>{fmtPct(s.avgChangePct)}</span>
                      <span className="text-xs text-slate-500">{s.advancers}▲ {s.decliners}▼</span>
                    </div>
                  ))}
                  {!sectorRot.length && <p className="text-slate-500 text-sm">No data</p>}
                </div>
              </div>
            </div>
          )}

          {/* ─── NEWS ─── */}
          {page === "news" && (
            <div className="space-y-3">
              <button className={btn("bg-blue-600 text-white")} onClick={async()=>{const r=await api("/market/news");setNews(r.items??[]);}}><RefreshCw size={13} className="inline mr-1"/>Refresh</button>
              {news.map((n,i)=>(
                <div key={i} className={card}>
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-green-400 transition-colors">{n.title}</a>
                      <div className="mt-1 text-xs text-slate-500">{n.source} · {new Date(n.pubDate).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</div>
                    </div>
                    <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white shrink-0"><ExternalLink size={13}/></a>
                  </div>
                </div>
              ))}
              {!news.length && <p className="text-center text-slate-500 py-10">No news loaded yet</p>}
            </div>
          )}

          {/* ─── ALERTS ─── */}
          {page === "alerts" && (
            <div className="space-y-4">
              <div className={card}>
                <h3 className="text-sm font-semibold mb-3">Create Alert</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  <SymbolCombobox value={alSym} exchange={alEx} onChange={setAlSym} onSelect={(s,ex)=>{setAlSym(s);setAlEx(ex);}} placeholder="Symbol"/>
                  <select className={inp} value={alEx} onChange={e=>setAlEx(e.target.value)}><option>NSE</option><option>BSE</option></select>
                  <select className={inp} value={alCond} onChange={e=>setAlCond(e.target.value)}>
                    <option value=">">Above (&gt;)</option><option value=">=">At/Above (≥)</option><option value="<">Below (&lt;)</option><option value="<=">At/Below (≤)</option>
                  </select>
                  <input className={inp} type="number" placeholder="Target Price ₹" value={alPrice} onChange={e=>setAlPrice(e.target.value)}/>
                  <select className={inp} value={alType} onChange={e=>setAlType(e.target.value)}><option value="once">Once</option><option value="recurring">Recurring</option></select>
                  <input className={inp} placeholder="Note (optional)" value={alNote} onChange={e=>setAlNote(e.target.value)}/>
                  <button className={btn("bg-green-600 text-white")} onClick={async()=>{
                    if(!alSym||!alPrice){alert("Fill symbol and price");return;}
                    await api("/alerts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol:alSym,exchange:alEx,condition:alCond,price:+alPrice,alert_type:alType,notes:alNote})});
                    const r=await api("/alerts");setAlerts(Array.isArray(r)?r:[]);setAlSym("");setAlPrice("");setAlNote("");
                  }}>Set Alert</button>
                </div>
              </div>
              <div className={card}>
                <h3 className="text-sm font-semibold mb-2">Active Alerts</h3>
                <div className="overflow-x-auto">
                  <table className="w-full"><thead><tr className="border-b border-[#334155]">
                    <th className={th}>Symbol</th><th className={th}>Condition</th><th className={`${th} text-right`}>Target</th><th className={`${th} text-right`}>LTP</th><th className={`${th} text-right`}>Distance</th><th className={th}>Type</th><th className={`${th} text-right`}>Hits</th><th className={th}></th>
                  </tr></thead>
                  <tbody>{alerts.filter((a:Record<string,unknown>)=>a.is_active).map((a:Record<string,unknown>)=>{
                    const ltp = a.ltp != null ? Number(a.ltp) : null;
                    const target = Number(a.price);
                    const distPct = ltp ? ((ltp - target) / target * 100) : null;
                    const isCross = distPct != null && (
                      (String(a.condition).startsWith(">") && ltp! >= target) ||
                      (String(a.condition).startsWith("<") && ltp! <= target)
                    );
                    return (
                    <tr key={String(a.id)} className={`hover:bg-white/[0.02] ${isCross?"bg-green-950/40":""}`}>
                      <td className={`${td} font-semibold`}>{String(a.symbol)}<br/><span className="text-[10px] text-slate-500">{String(a.exchange)}</span></td>
                      <td className={`${td} text-center font-mono text-amber-400`}>{String(a.condition)}</td>
                      <td className={`${td} text-right tabular-nums`}>₹{fmt(target)}</td>
                      <td className={`${td} text-right tabular-nums ${ltp?cc(Number(a.changePercent)):"text-slate-500"}`}>{ltp?`₹${fmt(ltp)}`:"—"}</td>
                      <td className={`${td} text-right tabular-nums text-xs ${isCross?"text-green-400 font-semibold":distPct!=null?cc(-Math.abs(distPct)):""}`}>
                        {distPct!=null?`${distPct>=0?"+":""}${distPct.toFixed(2)}%`:"—"}
                      </td>
                      <td className={`${td} text-xs`}>{String(a.alert_type)}</td>
                      <td className={`${td} text-right`}>{String(a.triggered_count||0)}</td>
                      <td className={`${td} flex gap-1`}>
                        <button className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-[#334155]" onClick={async()=>{await api("/alerts",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:a.id})});const r=await api("/alerts");setAlerts(Array.isArray(r)?r:[]);}}>Pause</button>
                        <button className="text-xs text-red-400 hover:text-red-300 px-2" onClick={async()=>{await api("/alerts",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:a.id})});const r=await api("/alerts");setAlerts(Array.isArray(r)?r:[]);}}>✕</button>
                      </td>
                    </tr>
                    );
                  })}</tbody></table>
                  {!alerts.filter((a:Record<string,unknown>)=>a.is_active).length && <p className="text-center text-slate-500 py-4">No active alerts</p>}
                </div>
              </div>
            </div>
          )}

          {/* ─── ALERT HISTORY ─── */}
          {page === "alert-history" && (
            <div className={card}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">Alert Trigger History</h3>
                <button className={btn("bg-blue-600 text-white text-xs")} onClick={async()=>{const h=await api("/alerts/history");setAlertHistory(Array.isArray(h)?h:[]);}}>Refresh</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full"><thead><tr className="border-b border-[var(--bd-s)]">
                  <th className={th}>Triggered At</th><th className={th}>Symbol</th><th className={th}>Condition</th><th className={`${th} text-right`}>Target</th><th className={`${th} text-right`}>Trigger LTP</th><th className={`${th} text-right`}>Diff%</th>
                </tr></thead>
                <tbody>{alertHistory.map((h:Record<string,unknown>)=>{
                  const tgt=Number(h.targetPrice)||0, ltp=Number(h.triggeredLtp)||0;
                  const diff=tgt?((ltp-tgt)/tgt*100):0;
                  return (
                  <tr key={String(h.id)} className="hover:bg-white/[0.02]">
                    <td className={`${td} text-xs`}>{new Date(String(h.triggeredAt)).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</td>
                    <td className={`${td} font-semibold`}>{String(h.symbol)}</td>
                    <td className={`${td} font-mono text-center text-amber-400`}>{String(h.condition)}</td>
                    <td className={`${td} text-right tabular-nums`}>₹{fmt(tgt)}</td>
                    <td className={`${td} text-right tabular-nums text-green-400`}>₹{fmt(ltp)}</td>
                    <td className={`${td} text-right tabular-nums text-xs ${cc(diff)}`}>{diff>=0?"+":""}{diff.toFixed(2)}%</td>
                  </tr>
                  );
                })}</tbody></table>
                {!alertHistory.length && <p className="text-center text-slate-500 py-6">No trigger history yet</p>}
              </div>
            </div>
          )}

          {/* ─── OPTIONS ─── */}
          {page === "options" && (
            <div className="space-y-4">
              <div className={`${card} flex gap-2 flex-wrap items-center`}>
                <input className={`${inp} max-w-[160px]`} placeholder="Symbol (NIFTY / BANKNIFTY / stock)" value={optSym} onChange={e=>setOptSym(e.target.value.toUpperCase())}/>
                <button className={btn("bg-blue-600 text-white")} onClick={async()=>{const r=await api(`/options?symbol=${optSym}`);setOptions(r);}}>Load Chain</button>
                {options && <span className="text-sm text-slate-400">Underlying: ₹{fmt(Number((options as Record<string,unknown>).underlying))} · PCR: {Number((options as Record<string,unknown>).pcr).toFixed(2)}</span>}
              </div>
              {options && (
                <div className={`${card} overflow-x-auto`}>
                  <table className="w-full text-xs"><thead><tr className="border-b border-[#334155]">
                    <th className={`${th} text-right`}>CE OI</th><th className={`${th} text-right`}>CE Vol</th><th className={`${th} text-right`}>CE IV</th>
                    <th className={`${th} text-right text-green-400`}>CE LTP</th><th className={`${th} text-center bg-[#0f172a]`}>STRIKE</th>
                    <th className={`${th} text-red-400`}>PE LTP</th><th className={th}>PE IV</th><th className={th}>PE Vol</th><th className={th}>PE OI</th>
                  </tr></thead>
                  <tbody>{((options as Record<string,unknown[]>).chain??[]).map((r:unknown)=>{
                    const row=r as {strike:number;ce:Record<string,number>;pe:Record<string,number>};
                    const atm=Math.abs(row.strike-Number((options as Record<string,unknown>).underlying))<200;
                    return (
                      <tr key={row.strike} className={`border-b border-[#1e293b] ${atm?"bg-blue-950/50":""}`}>
                        <td className="py-1 px-2 text-right">{(row.ce.oi/100000).toFixed(1)}L</td>
                        <td className="py-1 px-2 text-right">{(row.ce.vol/1000).toFixed(1)}K</td>
                        <td className="py-1 px-2 text-right">{row.ce.iv.toFixed(1)}%</td>
                        <td className="py-1 px-2 text-right text-green-400 font-bold">₹{fmt(row.ce.ltp)}</td>
                        <td className="py-1 px-2 text-center font-bold bg-[#0f172a]">₹{fmt(row.strike)}</td>
                        <td className="py-1 px-2 text-red-400 font-bold">₹{fmt(row.pe.ltp)}</td>
                        <td className="py-1 px-2">{row.pe.iv.toFixed(1)}%</td>
                        <td className="py-1 px-2">{(row.pe.vol/1000).toFixed(1)}K</td>
                        <td className="py-1 px-2">{(row.pe.oi/100000).toFixed(1)}L</td>
                      </tr>
                    );
                  })}</tbody></table>
                </div>
              )}
            </div>
          )}

          {/* ─── FILINGS ─── */}
          {page === "filings" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button className={btn("bg-blue-600 text-white")} onClick={async()=>{const r=await api("/filings");setFilings(Array.isArray(r)?r:[]);}}>
                  <RefreshCw size={13} className="inline mr-1"/>Refresh
                </button>
              </div>
              {filings.map(f=>(
                <div key={f.id} className={card}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${f.exchange==="NSE"?"bg-blue-900/60 text-blue-400":"bg-orange-900/60 text-orange-400"}`}>{f.exchange}</span>
                        {f.symbol && <span className="text-xs font-bold text-slate-300">{f.symbol}</span>}
                        {f.category && <span className="text-xs bg-[#334155] px-1.5 py-0.5 rounded text-slate-400">{f.category}</span>}
                      </div>
                      {f.company && <div className="text-sm font-medium mb-0.5">{f.company}</div>}
                      <div className="text-sm text-slate-400">{f.subject}</div>
                      <div className="text-xs text-slate-600 mt-1">{new Date(f.createdAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</div>
                    </div>
                    {f.attachment && <a href={f.attachment} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 shrink-0"><ExternalLink size={13}/></a>}
                  </div>
                </div>
              ))}
              {!filings.length && <p className="text-center text-slate-500 py-10">No filings loaded yet</p>}
            </div>
          )}

          {/* ─── BROKERS ─── */}
          {page === "brokers" && (
            <div className="space-y-4">
              {/* ICICI */}
              <div className={card}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">ICICI Direct (Breeze API)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Source 1 · Real-time WebSocket streaming</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${iciciStatus?.connected?"bg-green-900/50 text-green-400":"bg-[#334155] text-slate-400"}`}>
                    {iciciStatus?.connected ? `✓ ${iciciStatus.userName ?? "Connected"}` : "Not connected"}
                  </span>
                </div>
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-slate-400 mb-1">ONE-TIME SETUP — REDIRECT URL</p>
                  <p className="text-xs text-slate-500 mb-2">In the <b>api.icicidirect.com</b> developer portal, set your app's <b>Redirect URL</b> to:</p>
                  <div className="flex items-center gap-2 bg-[#1e293b] rounded px-3 py-2">
                    <code className="text-green-400 text-xs flex-1">https://maxcap.co.in/api/broker/icici/oauth-callback</code>
                    <button onClick={()=>navigator.clipboard?.writeText("https://maxcap.co.in/api/broker/icici/oauth-callback")} className="text-slate-400 hover:text-white"><Copy size={12}/></button>
                  </div>
                </div>
                {iciciStatus?.connected ? (
                  <button className={btn("bg-red-700 text-white")} onClick={async()=>{await api("/broker/icici/disconnect",{method:"POST"});refreshBrokers();}}>Disconnect</button>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-xs text-slate-500 mb-1 block">API Key</label><input className={inp} placeholder="From api.icicidirect.com" value={iciKey} onChange={e=>setIciKey(e.target.value)}/></div>
                      <div><label className="text-xs text-slate-500 mb-1 block">Secret Key</label><input className={inp} type="password" placeholder="Secret key" value={iciSecret} onChange={e=>setIciSecret(e.target.value)}/></div>
                    </div>
                    <button className={`${btn("bg-blue-600 text-white")} w-full`} onClick={async()=>{
                      if(!iciKey||!iciSecret){alert("Fill API key and secret");return;}
                      const r=await api("/broker/icici/prepare-oauth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:iciKey,apiSecret:iciSecret})});
                      if(r.loginUrl) window.open(r.loginUrl,"_blank",`width=600,height=700`);
                      else alert("Failed: "+(r.error||"unknown"));
                    }}>Open ICICI Login ↗</button>
                  </div>
                )}
              </div>

              {/* Fyers */}
              <div className={card}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Fyers</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Source 2 · Real-time WebSocket streaming</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${fyersStatus?.connected?"bg-green-900/50 text-green-400":"bg-[#334155] text-slate-400"}`}>
                    {fyersStatus?.connected ? `✓ ${fyersStatus.uid ?? "Connected"}` : "Not connected"}
                  </span>
                </div>
                {fyRedirect && (
                  <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-3 mb-4">
                    <p className="text-xs font-semibold text-slate-400 mb-1">REGISTER THIS REDIRECT URI AT myapi.fyers.in</p>
                    <div className="flex items-center gap-2 bg-[#1e293b] rounded px-3 py-2">
                      <code className="text-green-400 text-xs flex-1">{fyRedirect}</code>
                      <button onClick={()=>navigator.clipboard?.writeText(fyRedirect)} className="text-slate-400 hover:text-white"><Copy size={12}/></button>
                    </div>
                  </div>
                )}
                {fyersStatus?.connected ? (
                  <button className={btn("bg-red-700 text-white")} onClick={async()=>{await api("/broker/fyers/disconnect",{method:"POST"});refreshBrokers();}}>Disconnect</button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">1. Create an app at <b>myapi.fyers.in</b> and register the redirect URI shown above.<br/>2. Enter App ID + Secret → Connect to get the redirect URI.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-xs text-slate-500 mb-1 block">App ID</label><input className={inp} placeholder="e.g. XY1234-100" value={fyAppId} onChange={e=>setFyAppId(e.target.value)}/></div>
                      <div><label className="text-xs text-slate-500 mb-1 block">Secret Key</label><input className={inp} type="password" placeholder="Secret key" value={fySecret} onChange={e=>setFySecret(e.target.value)}/></div>
                    </div>
                    <button className={`${btn("bg-blue-600 text-white")} w-full`} onClick={async()=>{
                      if(!fyAppId||!fySecret){alert("Fill App ID and Secret");return;}
                      const r=await api("/broker/fyers/prepare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({appId:fyAppId,secret:fySecret})});
                      if(r.redirectUri) setFyRedirect(r.redirectUri);
                      if(r.loginUrl){window.open(r.loginUrl,"_blank",`width=600,height=700`);setTimeout(refreshBrokers,8000);}
                      else alert("Failed: "+(r.error||"unknown"));
                    }}>Connect via Fyers Login</button>
                  </div>
                )}
              </div>

              {/* Data source waterfall */}
              <div className={card}>
                <h3 className="text-sm font-semibold mb-3">Data Source Waterfall</h3>
                <p className="text-xs text-slate-500 mb-3">Sources tried in order. Login to a broker to unlock real-time data.</p>
                {[
                  {n:"ICICI Direct Breeze",t:"real-time",active:!!iciciStatus?.connected},
                  {n:"Fyers",t:"real-time",active:!!fyersStatus?.connected},
                  {n:"Yahoo Finance",t:"~15min delay",active:true,always:true},
                ].map((s,i)=>(
                  <div key={s.n} className="flex items-center gap-3 py-2 border-b border-[#1e293b] last:border-0">
                    <span className="text-slate-500 text-sm w-4">{i+1}.</span>
                    <span className={`w-2 h-2 rounded-full ${s.active||s.always?"bg-green-500":"bg-[#334155]"}`}/>
                    <span className="flex-1 text-sm">{s.n}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${s.t.includes("real")?"bg-green-900/50 text-green-400":"bg-[#334155] text-slate-400"}`}>{s.t}</span>
                    {s.active && <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded">ACTIVE</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── SYMBOLS ─── */}
          {page === "symbols" && (
            <div className="space-y-4">
              {symStatus && (
                <div className={card}>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold">Symbol Master</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${symStatus.status?.state==="running"?"bg-amber-900/50 text-amber-400":symStatus.total?"bg-green-900/50 text-green-400":"bg-[#334155] text-slate-400"}`}>
                      {symStatus.status?.state==="running"?"Downloading…":symStatus.total?`Ready · ${(symStatus.total/1000).toFixed(0)}k symbols`:"Not downloaded"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                    {Object.entries(symStatus.byExchange||{}).map(([ex,cnt])=>(
                      <div key={ex} className="text-center bg-[#0f172a] rounded-lg p-2">
                        <div className="text-xs text-slate-500">{ex}</div>
                        <div className="text-lg font-bold">{(cnt/1000).toFixed(0)}k</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[["NSE+BSE","NSE,BSE"],["NFO+BFO","NFO,BFO"],["MCX","MCX"],["MF (AMFI)","MF"]].map(([label,exs])=>(
                      <button key={exs} disabled={symDownloading} className={btn("bg-[#334155] text-slate-200")} onClick={async()=>{
                        setSymDownloading(true);
                        await api("/symbols/download",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({exchanges:exs.split(",")})});
                        setSymDownloading(false);const r=await api("/symbols/status");setSymStatus(r);
                      }}><Download size={13} className="inline mr-1"/>{label}</button>
                    ))}
                    <button disabled={symDownloading} className={btn("bg-blue-600 text-white")} onClick={async()=>{
                      setSymDownloading(true);
                      await api("/symbols/download",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({exchanges:["NSE","BSE","NFO","BFO","MCX","MF"]})});
                      setSymDownloading(false);const r=await api("/symbols/status");setSymStatus(r);
                    }}>{symDownloading?<Loader2 size={13} className="animate-spin inline mr-1"/>:<Download size={13} className="inline mr-1"/>}Download All 6</button>
                  </div>
                </div>
              )}
              <div className={card}>
                <h3 className="text-sm font-semibold mb-3">Symbol Search</h3>
                <div className="flex gap-2 mb-3">
                  <input className={`${inp} flex-1`} placeholder="Search any symbol or company name…"
                    value={symQuery} onChange={e=>setSymQuery(e.target.value)}
                    onKeyDown={async e=>{if(e.key==="Enter"&&symQuery.trim()){const r=await api(`/symbols/search?q=${encodeURIComponent(symQuery)}&limit=20`);setSymResults(Array.isArray(r)?r:[]);}}}/>
                  <button className={btn("bg-blue-600 text-white")} onClick={async()=>{
                    if(!symQuery.trim())return;
                    const r=await api(`/symbols/search?q=${encodeURIComponent(symQuery)}&limit=20`);
                    setSymResults(Array.isArray(r)?r:[]);
                  }}>Search</button>
                </div>
                {symResults.length>0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full"><thead><tr className="border-b border-[#334155]">
                      <th className={th}>Symbol</th><th className={th}>Name</th><th className={th}>Exchange</th><th className={th}>Type</th><th className={th}>ISIN</th>
                    </tr></thead>
                    <tbody>{symResults.map(r=>(
                      <tr key={`${r.symbol}:${r.exchange}`} className="hover:bg-white/[0.02]">
                        <td className={`${td} font-semibold text-green-400`}>{r.baseSymbol}</td>
                        <td className={`${td} text-slate-400`}>{r.name}</td>
                        <td className={td}>{r.exchange}</td>
                        <td className={td}><span className="text-xs bg-[#334155] px-1.5 py-0.5 rounded">{r.type}</span></td>
                        <td className={`${td} text-xs text-slate-500`}>{r.symbol}</td>
                      </tr>
                    ))}</tbody></table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── SETTINGS ─── */}
          {page === "settings" && (
            <div className="space-y-4">
              {/* Theme */}
              <div className={card}>
                <h3 className="font-semibold mb-3">Appearance</h3>
                <div className="flex gap-3">
                  {(["dark","light","sepia"] as const).map(t=>(
                    <button key={t} onClick={()=>setTheme(t)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all capitalize ${theme===t?"border-green-500 bg-green-500/10 text-green-400":"border-[var(--bd-s)] text-[var(--fg-m)] hover:border-[var(--fg-d)]"}`}>
                      {t==="dark"?"🌙 Dark":t==="light"?"☀️ Light":"📜 Sepia"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[var(--fg-d)] mt-2">Theme saved automatically.</p>
              </div>
              {/* Telegram */}
              <div className={card}>
                <h3 className="font-semibold mb-1">Telegram Notifications</h3>
                <p className="text-xs text-slate-500 mb-4">Receive alerts, morning brief, EOD P&L, and filings via Telegram.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Bot Token <span className="text-slate-600">(from @BotFather)</span></label>
                    <input className={inp} placeholder="1234567890:ABC..." value={settingsForm.tg_token??""} onChange={e=>setSettingsForm(f=>({...f,tg_token:e.target.value}))}/>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Chat ID</label>
                    <input className={inp} placeholder="-100123456789" value={settingsForm.tg_chat_id??""} onChange={e=>setSettingsForm(f=>({...f,tg_chat_id:e.target.value}))}/>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button className={btn("bg-green-600 text-white")} onClick={async()=>{
                    await api("/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(settingsForm)});
                    setSettingsSaved(true);setTimeout(()=>setSettingsSaved(false),2000);
                  }}>{settingsSaved?"✓ Saved!":"Save Configuration"}</button>
                  <button className={btn("bg-[#334155] text-slate-200")} onClick={async()=>{
                    if(!settingsForm.tg_token||!settingsForm.tg_chat_id){alert("Save config first");return;}
                    const r=await fetch(`https://api.telegram.org/bot${settingsForm.tg_token}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:settingsForm.tg_chat_id,text:"✅ BINGO test message — Telegram connected!"})});
                    const d=await r.json(); if(d.ok) alert("✅ Test sent!"); else alert("❌ "+JSON.stringify(d));
                  }}>Send Test</button>
                </div>
              </div>

              {/* AI Status */}
              <div className={card}>
                <h3 className="font-semibold mb-3">AI Providers</h3>
                <div className="space-y-2">
                  {(aiStatus?.providers??[]).map(p=>(
                    <div key={p.name} className="flex items-center gap-3 py-1.5 border-b border-[#1e293b] last:border-0">
                      {p.configured ? <CheckCircle2 size={14} className="text-green-400"/> : <Circle size={14} className="text-slate-600"/>}
                      <span className="text-sm capitalize font-medium">{p.name}</span>
                      <span className={`text-xs ml-auto ${p.configured?"text-green-400":"text-slate-500"}`}>{p.configured?"Configured":"Not configured"}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-3">Set GROQ_API_KEY, CEREBRAS_API_KEY, OPENROUTER_API_KEY in Coolify env vars for AI features.</p>
              </div>

              {/* Other settings */}
              <div className={card}>
                <h3 className="font-semibold mb-3">Misc</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[["tg_secondary_token","Secondary Bot Token (optional)"],["tg_secondary_chat_id","Secondary Chat ID (optional)"]].map(([k,l])=>(
                    <div key={k}>
                      <label className="text-xs text-slate-500 block mb-1">{l}</label>
                      <input className={inp} value={settingsForm[k]??""} onChange={e=>setSettingsForm(f=>({...f,[k]:e.target.value}))}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>

        {/* ── Bottom status bar ── */}
        <footer className="h-6 bg-[var(--bg-panel)] border-t border-[var(--bd)] px-4 hidden md:flex items-center gap-4 text-[11px] text-[var(--fg-d)] shrink-0">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${streamStatus?.streaming?"bg-green-400 animate-pulse":"bg-slate-600"}`}/>
            {streamStatus?.streaming ? `● ${streamStatus.source?.toUpperCase()} LIVE` : "● Offline"}
          </span>
          {streamStatus?.lastTickAgeSec != null && <span>Tick: {streamStatus.lastTickAgeSec}s ago</span>}
          <span className={`${mktStatus?.isOpen?"text-green-400":"text-slate-600"}`}>
            {mktStatus?.isOpen ? "● Market Open" : "● Market Closed"}
          </span>
          {mktStatus?.message && <span>{mktStatus.message}</span>}
          <span className="ml-auto tabular-nums">{nowIST} IST</span>
        </footer>
      </div>

      {/* ── Floating AI panel (legacy one-shot, kept for dashboard AI button) ── */}
      <AiPanel title={aiTitle} text={aiText} busy={aiBusy} onClose={()=>{setAiTitle("");setAiText("");}}/>

      {/* ── Persistent AI Chat Panel ── */}
      <ChatPanel open={chatOpen} onClose={()=>setChatOpen(false)}/>

      {/* ── Floating AI button (hidden when chat is open or a panel is covering it) ── */}
      {!chatOpen && (
        <button onClick={()=>setChatOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-8 z-40 w-12 h-12 bg-green-600 hover:bg-green-500 rounded-full shadow-lg flex items-center justify-center transition-all">
          <Sparkles size={18} className="text-white"/>
        </button>
      )}

      {/* ── Risk Calculator slide-over ── */}
      <RiskCalc open={riskOpen} onClose={()=>setRiskOpen(false)}/>

      {/* ── Quick Notepad ── */}
      <QuickNotepad open={noteOpen} onClose={()=>setNoteOpen(false)}/>

      {/* ── Mobile nav + drawer ── */}
      <MobileNav page={page} go={goTo} onMore={()=>setMobileDrawer(true)}/>
      <MobileDrawer open={mobileDrawer} page={page} go={goTo} onClose={()=>setMobileDrawer(false)}/>

    </div>
  );
}
