/**
 * AI Provider — 4-fallback routing
 * Groq → Cerebras → OpenRouter → Anthropic
 */
import OpenAI from "openai";

const PROVIDERS = [
  { name: "groq",       base: "https://api.groq.com/openai/v1",      env: "GROQ_API_KEY",       model: "llama-3.3-70b-versatile",                    maxTokens: 4096 },
  { name: "cerebras",   base: "https://api.cerebras.ai/v1",           env: "CEREBRAS_API_KEY",   model: "llama3.1-70b",                               maxTokens: 2048 },
  { name: "openrouter", base: "https://openrouter.ai/api/v1",         env: "OPENROUTER_API_KEY", model: "meta-llama/llama-3.3-70b-instruct:free",     maxTokens: 2048 },
  { name: "anthropic",  base: "https://api.anthropic.com/v1",         env: "ANTHROPIC_API_KEY",  model: "claude-haiku-4-5-20251001",                  maxTokens: 2048 },
];

const LONG_FORM = new Set(["portfolio_analysis","research_report","filing_results","screener_summary"]);

// Simple per-minute rate tracker
const reqCounts: Record<string, { count: number; reset: number }> = {};
const LIMITS: Record<string, number> = { groq: 24, cerebras: 24, openrouter: 15, anthropic: 50 };

function canUse(name: string): boolean {
  const now = Date.now();
  if (!reqCounts[name] || now > reqCounts[name].reset) {
    reqCounts[name] = { count: 0, reset: now + 60000 };
  }
  return reqCounts[name].count < (LIMITS[name] ?? 10);
}
function record(name: string) {
  if (reqCounts[name]) reqCounts[name].count++;
}

export async function askAI(
  prompt: string,
  system = "",
  maxTokens = 600,
  task = "general"
): Promise<{ text: string; provider: string; model: string }> {
  const msgs: { role: "system" | "user"; content: string }[] = [];
  if (system) msgs.push({ role: "system", content: system });
  msgs.push({ role: "user", content: prompt });

  const order = LONG_FORM.has(task)
    ? [PROVIDERS[1], PROVIDERS[0], PROVIDERS[2], PROVIDERS[3]]
    : PROVIDERS;

  let lastErr: unknown;
  for (const p of order) {
    const key = process.env[p.env];
    if (!key) continue;
    if (!canUse(p.name)) continue;
    try {
      const headers: Record<string, string> = p.name === "openrouter"
        ? { "HTTP-Referer": "https://bingo.vercel.app", "X-Title": "BINGO" }
        : {};
      const client = new OpenAI({ baseURL: p.base, apiKey: key, defaultHeaders: headers });
      const res = await client.chat.completions.create({
        model: p.model, max_tokens: Math.min(maxTokens, p.maxTokens), messages: msgs,
      });
      const text = res.choices[0]?.message?.content ?? "";
      if (!text) throw new Error("Empty response");
      record(p.name);
      return { text, provider: p.name, model: p.model };
    } catch (e) {
      lastErr = e;
      if ((e as { status?: number }).status === 429) {
        if (reqCounts[p.name]) reqCounts[p.name].count = LIMITS[p.name] ?? 999;
      }
    }
  }
  throw new Error(`All AI providers failed: ${lastErr}`);
}

export function getAIStatus() {
  return PROVIDERS.map(p => ({ name: p.name, configured: !!process.env[p.env] }));
}

// Per-user rate limit (60/hour)
const userLimits: Record<string, number[]> = {};
export function checkUserLimit(userId = "default"): boolean {
  const now = Date.now();
  userLimits[userId] = (userLimits[userId] ?? []).filter(t => now - t < 3600000);
  if (userLimits[userId].length >= 60) return false;
  userLimits[userId].push(now);
  return true;
}
