import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: true, // don't connect until first command (avoids build-time connection attempts)
    enableOfflineQueue: true,
  });

// Swallow connection errors so a transient Redis blip never crashes the process
redis.on("error", () => { /* logged by callers where relevant */ });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// Cache helpers — JSON value with TTL (seconds)
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const v = await redis.get(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* cache failures are non-fatal */
  }
}
