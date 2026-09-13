import assert from "node:assert/strict";
import test from "node:test";

import { findAvailablePort } from "../src/utils/ports";

test("skips reserved and unavailable ports", async () => {
  const unavailable = new Set([5001]);
  const selected = await findAvailablePort(
    5000,
    new Set([5000]),
    async (port) => !unavailable.has(port),
  );

  assert.equal(selected, 5002);
});

test("reports when the valid port range is exhausted", async () => {
  await assert.rejects(
    findAvailablePort(65535, new Set(), async () => false),
    /No available host port/,
  );
});
