/**
 * Fyers real-time WebSocket streaming (worker-side).
 * Connects to the HSM data socket, subscribes to symbols, and writes every
 * tick straight into Redis (price:EXCHANGE:SYMBOL) — the same key the web app
 * and alert monitor read. This replaces 30s polling with sub-second ticks
 * whenever a Fyers session is connected.
 *
 * Protocol (from the Replit fyersWebSocket reference):
 *   URL: wss://socket.fyers.in/hsm/v1-5/prod
 *   Header auth: Authorization: <hsm_key>  (hsm_key is inside the JWT payload)
 *   AUTH msg: {"T":"AUTH","DATA":{"access_token":"<appId>:<accessToken>"}}
 *   Subscribe: {"T":"SUB_DATA","SLIST":["NSE:SBIN-EQ"],"SUB_T":1}
 *   Tick: {"T":"SUB_DATA","s":"ok","d":{"NSE:SBIN-EQ":[type,tok,ts,ltp,open,high,low,prevClose,chg,chgPct,vol,...]}}
 */
import WebSocket from "ws";
import { cacheSet } from "./redis";
import { fromFyersSymbol, type FyersSession } from "./broker-fyers";

const WS_URL = "wss://socket.fyers.in/hsm/v1-5/prod";
const SUB_T = 1;
const PING_MS = 30_000;
const RECONNECT = [2000, 4000, 8000, 15000, 30000];

let ws: WebSocket | null = null;
let session: FyersSession | null = null;
let connected = false;
let intentional = false;
let attempt = 0;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const subscribed = new Set<string>();
const pending = new Set<string>();

const log = (...a: unknown[]) => console.log(new Date().toISOString(), "[fyers-ws]", ...a);

function hsmKey(accessToken: string): string {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64").toString("utf8"));
    return typeof payload.hsm_key === "string" && payload.hsm_key ? payload.hsm_key : accessToken;
  } catch { return accessToken; }
}

export function fyersWsStatus() {
  return { connected, subscribed: subscribed.size, pending: pending.size };
}

export function startFyersStream(s: FyersSession, fyersSymbols: string[]) {
  session = s;
  intentional = false;
  attempt = 0;
  for (const sym of fyersSymbols) if (!subscribed.has(sym)) pending.add(sym);
  if (!ws || ws.readyState !== WebSocket.OPEN) open();
  else flush();
}

export function stopFyersStream() {
  intentional = true;
  connected = false;
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { try { ws.removeAllListeners(); ws.close(); } catch { /* ignore */ } ws = null; }
  subscribed.clear(); pending.clear();
  log("stopped");
}

function open() {
  if (!session) return;
  if (ws) { try { ws.removeAllListeners(); ws.close(); } catch { /* ignore */ } }
  connected = false;
  for (const s of subscribed) pending.add(s);
  subscribed.clear();
  ws = new WebSocket(WS_URL, { headers: { Authorization: hsmKey(session.accessToken) } });
  ws.on("open", onOpen);
  ws.on("message", onMessage);
  ws.on("error", (e: Error) => log("error", e.message));
  ws.on("close", onClose);
}

function onOpen() {
  if (!session) return;
  connected = true;
  attempt = 0;
  log("connected");
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = setInterval(() => { if (ws?.readyState === WebSocket.OPEN) { try { ws.ping(); } catch { /* ignore */ } } }, PING_MS);
  ws?.send(JSON.stringify({ T: "AUTH", DATA: { access_token: `${session.appId}:${session.accessToken}` } }));
  // Flush after a short delay even if AUTH ack doesn't arrive
  setTimeout(() => { if (connected) flush(); }, 1500);
}

function flush() {
  if (!pending.size || !ws || ws.readyState !== WebSocket.OPEN) return;
  const list = Array.from(pending);
  pending.clear();
  for (const s of list) subscribed.add(s);
  ws.send(JSON.stringify({ T: "SUB_DATA", SLIST: list, SUB_T }));
  log("subscribed", list.length);
}

function onMessage(raw: WebSocket.RawData) {
  if (Buffer.isBuffer(raw)) return; // HSM endpoint sends JSON text
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw.toString()); } catch { return; }
  const T = data.T as string | undefined;
  const s = data.s as string | undefined;
  if (T === "AUTH" && s === "ok") { flush(); return; }
  if (T === "SUB_DATA" && s === "ok" && data.d) {
    for (const [fy, arr] of Object.entries(data.d as Record<string, unknown>)) {
      if (!Array.isArray(arr) || arr.length < 4) continue;
      const ltp = typeof arr[3] === "number" ? arr[3] : 0;
      if (!ltp || ltp <= 0) continue;
      const { exchange, symbol } = fromFyersSymbol(fy);
      const prevClose = typeof arr[7] === "number" ? arr[7] : 0;
      const quote = {
        symbol, exchange, ltp, prevClose,
        change: typeof arr[8] === "number" ? arr[8] : (prevClose ? ltp - prevClose : 0),
        changePercent: typeof arr[9] === "number" ? arr[9] : (prevClose ? ((ltp - prevClose) / prevClose) * 100 : 0),
        source: "fyers", live: true,
      };
      void cacheSet(`price:${exchange}:${symbol}`, quote, 86400);
    }
  }
}

function onClose() {
  connected = false;
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (intentional) return;
  const delay = RECONNECT[Math.min(attempt, RECONNECT.length - 1)];
  attempt++;
  log("closed — reconnecting in", delay, "ms");
  reconnectTimer = setTimeout(() => { if (!intentional && session) open(); }, delay);
}
