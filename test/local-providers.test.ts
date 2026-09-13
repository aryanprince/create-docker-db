import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  addGitignoreEntry,
  createLocalDatabase,
  resolveLocalDatabasePath,
} from "../src/providers/local";

test("creates a private SQLite file and returns a file URL", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "create-docker-db-"));

  try {
    const setup = createLocalDatabase(directory, "data/local.db", "sqlite");

    assert.equal(setup.connectionUrl, "file:./data/local.db");
    assert.equal(setup.created, true);
    assert.ok(fs.existsSync(setup.filePath));
    assert.equal(fs.statSync(setup.filePath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test("returns the official local libSQL development command", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "create-docker-db-"));

  try {
    const setup = createLocalDatabase(directory, "local.db", "libsql");

    assert.equal(setup.connectionUrl, "http://127.0.0.1:8080");
    assert.equal(setup.startCommand, 'turso dev --db-file "local.db"');
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test("rejects paths outside the project", () => {
  assert.throws(
    () => resolveLocalDatabasePath("/tmp/project", "../private.db"),
    /inside the current project/,
  );
});

test("adds a gitignore entry only once", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "create-docker-db-"));

  try {
    assert.equal(addGitignoreEntry(directory, "local.db"), true);
    assert.equal(addGitignoreEntry(directory, "local.db"), false);
    assert.equal(
      fs.readFileSync(path.join(directory, ".gitignore"), "utf8"),
      "local.db\n",
    );
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
