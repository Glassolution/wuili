import { strict as assert } from "node:assert";
import { backfillAuthorized, parseBackfillInput } from "./policy.ts";

Deno.test("backfill defaults to dry run, max 7 days", () => {
  assert.deepEqual(parseBackfillInput({}), { days: 7, dry_run: true });
  assert.deepEqual(parseBackfillInput({ days: 1, dry_run: false }), { days: 1, dry_run: false });
  for (const days of [0, 8, 1.5, "7", null]) assert.equal(parseBackfillInput({ days }), null);
  assert.equal(parseBackfillInput({ dry_run: null }), null);
  assert.equal(parseBackfillInput({ days: 8 }), null);
  assert.equal(parseBackfillInput({ dry_run: "false" }), null);
  assert.equal(parseBackfillInput({ unexpected: true }), null);
});
Deno.test("service credential or verified admin only; ordinary user and forged claims denied", async () => {
  assert.equal(await backfillAuthorized("simulation-service", "simulation-service", async () => null, async () => false), true);
  assert.equal(await backfillAuthorized("simulation-user", "simulation-service", async () => "admin-user", async id => id === "admin-user"), true);
  assert.equal(await backfillAuthorized("simulation-user", "simulation-service", async () => "normal-user", async () => false), false);
  assert.equal(await backfillAuthorized("forged-role", "simulation-service", async () => null, async () => true), false);
  assert.equal(await backfillAuthorized("", "simulation-service", async () => "admin-user", async () => true), false);
});