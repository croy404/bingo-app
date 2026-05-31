/**
 * Canonical public base URL of the app (no trailing slash).
 *
 * Broker OAuth redirect URIs must EXACTLY match what's registered in the broker
 * portal. Deriving the origin from the incoming request is fragile — opening the
 * app via the sslip.io fallback or the raw EC2 IP would generate a redirect that
 * doesn't match the registered `https://maxcap.co.in/...` and the broker rejects
 * it ("redirectUrl mismatch"). Set APP_URL in Coolify to pin it deterministically.
 *
 * Falls back to the request origin when APP_URL is unset (e.g. local dev).
 */
export function appBaseUrl(req: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(req.url).origin;
}
