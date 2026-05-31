/**
 * ICICI Breeze real-time streaming (worker-side) — Socket.IO v4.
 *
 * Server: https://livestream.icicidirect.com
 * Auth:   extraHeaders { user: <iciUserId>, token: <apiSessionToken> }
 * Subscribe:   socket.emit("join", JSON.stringify({ task:"cn", channel:"TOKEN.EXCH" }))  NSE=4 BSE=6
 * Unsubscribe: task "dc"
 * Tick:        socket.on("message", { symbol: channel, last, open, high, low, close, ttq, ltt })
 *
 * Tokens are the exchange tokens from the Shoonya scrip master (same values
 * Breeze uses). Ticks are written to Redis price:EXCHANGE:SYMBOL — the same key
 * the web app and alert monitor read.
 */
import { io, type Socket } from "socket.io-client";
import { cacheSet } from "./redis";
import type { BreezeSession } from "./broker-icici";

const SERVER = "https://livestream.icicidirect.com";
const RECONNECT = [2000, 4000, 8000, 15000, 30000];

let socket: Socket | null = null;
let session: BreezeSession | null = null;
let connected = false;
let intentional = false;
let attempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

type Item = { symbol: string; exchange: string; token: string };
const subscribed = new Map<string, { symbol: string; exchange: string; prevClose: number }>(); // channel -> info
let pending: Item[] = [];

const log = (...a: unknown[]) => console.log(new Date().toISOString(), "[breeze-ws]", ...a);

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  return 0;
}

export function breezeWsStatus() {
  return { connected, subscribed: subscribed.size, pending: pending.length };
}

export function startBreezeStream(s: BreezeSession, items: Item[]) {
  session = s;
  intentional = false;
  attempt = 0;
  // queue only new channels
  for (const it of items) {
    if (!it.token) continue;
    const ch = `${it.token}.${it.exchange.toUpperCase() === "BSE" ? "6" : "4"}`;
    if (!subscribed.has(ch) && !pending.find((p) => p.token === it.token && p.exchange === it.exchange)) {
      pending.push(it);
    }
  }
  if (!socket || !connected) open();
  else flush();
}

export function stopBreezeStream() {
  intentional = true;
  connected = false;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (socket) { try { socket.removeAllListeners(); socket.disconnect(); } catch { /* ignore */ } socket = null; }
  subscribed.clear(); pending = [];
  log("stopped");
}

function open() {
  if (!session) return;
  if (socket) { try { socket.removeAllListeners(); socket.disconnect(); } catch { /* ignore */ } }
  connected = false;
  // re-queue subscribed channels
  for (const [, info] of subscribed) pending.push({ symbol: info.symbol, exchange: info.exchange, token: "" });
  subscribed.clear();
  socket = io(SERVER, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 15000,
    extraHeaders: { user: session.iciUserId, token: session.apiSessionToken },
  });
  socket.on("connect", onConnect);
  socket.on("disconnect", onClose);
  socket.on("connect_error", (e: Error) => { log("connect_error", e.message); onClose(); });
  socket.on("message", onMessage);
}

function onConnect() {
  connected = true;
  attempt = 0;
  log("connected");
  flush();
}

function flush() {
  if (!socket?.connected || !pending.length) return;
  const items = pending.filter((p) => p.token);
  pending = pending.filter((p) => !p.token); // drop tokenless (will be re-resolved by worker next cycle)
  let sent = 0;
  for (const it of items) {
    const code = it.exchange.toUpperCase() === "BSE" ? "6" : "4";
    const channel = `${it.token}.${code}`;
    subscribed.set(channel, { symbol: it.symbol.toUpperCase(), exchange: it.exchange.toUpperCase(), prevClose: 0 });
    socket.emit("join", JSON.stringify({ task: "cn", channel }));
    sent++;
  }
  if (sent) log("subscribed", sent, "channels");
}

function onMessage(data: unknown) {
  let msg: Record<string, unknown>;
  try { msg = (typeof data === "string" ? JSON.parse(data) : data) as Record<string, unknown>; } catch { return; }
  if (!msg || typeof msg !== "object") return;
  const channel = msg.symbol as string | undefined;
  if (!channel) return;
  const ltp = num(msg.last);
  if (!ltp || ltp <= 0) return;
  const info = subscribed.get(channel);
  if (!info) return;
  const prevClose = num(msg.close) || info.prevClose;
  if (prevClose) info.prevClose = prevClose;
  const quote = {
    symbol: info.symbol, exchange: info.exchange, ltp, prevClose,
    change: prevClose ? ltp - prevClose : 0,
    changePercent: prevClose ? ((ltp - prevClose) / prevClose) * 100 : 0,
    source: "icici", live: true,
  };
  void cacheSet(`price:${info.exchange}:${info.symbol}`, quote, 86400);
}

function onClose() {
  connected = false;
  if (intentional) return;
  const delay = RECONNECT[Math.min(attempt, RECONNECT.length - 1)];
  attempt++;
  log("disconnected — reconnecting in", delay, "ms");
  reconnectTimer = setTimeout(() => { if (!intentional && session) open(); }, delay);
}
