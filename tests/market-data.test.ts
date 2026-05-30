import { test } from "node:test";
import assert from "node:assert";
import { xirrNewton } from "../lib/market-data";

test("xirrNewton: doubling over one year ≈ 100%", () => {
  const r = xirrNewton([
    { amount: -1000, date: new Date("2025-01-01") },
    { amount: 2000, date: new Date("2026-01-01") },
  ]);
  assert.ok(r !== null, "should converge");
  assert.ok(Math.abs((r as number) - 1.0) < 0.05, `expected ~1.0, got ${r}`);
});

test("xirrNewton: returns null for single cashflow", () => {
  assert.strictEqual(xirrNewton([{ amount: -1000, date: new Date() }]), null);
});

test("xirrNewton: flat (no gain) ≈ 0%", () => {
  const r = xirrNewton([
    { amount: -1000, date: new Date("2025-01-01") },
    { amount: 1000, date: new Date("2026-01-01") },
  ]);
  assert.ok(r !== null && Math.abs(r) < 0.01, `expected ~0, got ${r}`);
});
