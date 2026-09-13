import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createRemoteConnectionProfile,
  mergeEnvExample,
  writeEnvExampleAtomically,
} from "../src/providers/remote";

test("creates a Turso profile without live credentials", () => {
  const profile = createRemoteConnectionProfile("turso", "my-db");

  assert.equal(
    profile.variables.TURSO_AUTH_TOKEN,
    "replace-with-a-turso-auth-token",
  );
  assert.match(profile.instructions.join("\n"), /turso db show 'my-db' --url/);
});

test("creates PlanetScale engine profiles with required TLS parameters", () => {
  const mysql = createRemoteConnectionProfile(
    "planetscale-mysql",
    "my-db",
    "development",
  );
  const postgres = createRemoteConnectionProfile(
    "planetscale-postgres",
    "my-db",
  );

  assert.match(
    mysql.variables.PLANETSCALE_DATABASE_URL ?? "",
    /sslaccept=strict/,
  );
  assert.match(mysql.instructions[0] ?? "", /pscale connect/);
  assert.match(
    postgres.variables.PLANETSCALE_DATABASE_URL ?? "",
    /sslmode=verify-full&sslrootcert=system/,
  );
});

test("merges placeholders without replacing existing variables", () => {
  const profile = createRemoteConnectionProfile("turso", "my-db");
  const merged = mergeEnvExample(
    "APP_ENV=development\nTURSO_AUTH_TOKEN=keep-me\n",
    profile,
  );

  assert.deepEqual(merged.added, ["TURSO_DATABASE_URL"]);
  assert.deepEqual(merged.existing, ["TURSO_AUTH_TOKEN"]);
  assert.match(merged.content, /TURSO_AUTH_TOKEN=keep-me/);
  assert.doesNotMatch(merged.content, /replace-with-a-turso-auth-token/);
});

test("writes .env.example atomically", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "create-docker-db-"));

  try {
    const filePath = writeEnvExampleAtomically(
      directory,
      "DATABASE_URL=example\n",
    );
    assert.equal(fs.readFileSync(filePath, "utf8"), "DATABASE_URL=example\n");
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
