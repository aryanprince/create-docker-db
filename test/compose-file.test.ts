import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ComposeConflictError,
  findComposeFile,
  mergeComposeDocument,
} from "../src/utils/compose-file";

const fragment = {
  projectName: "demo",
  services: {
    "postgres-db": {
      image: "postgres:17",
      ports: ["127.0.0.1:6969:5432"],
    },
  },
  volumes: { "demo-postgres-data": null },
};

test("creates a canonical Compose document", () => {
  const result = mergeComposeDocument(undefined, fragment);

  assert.match(result.content, /^services:/);
  assert.match(result.content, /name: demo/);
  assert.deepEqual(result.addedServices, ["postgres-db"]);
  assert.deepEqual(result.addedVolumes, ["demo-postgres-data"]);
});

test("adds services while preserving existing comments and project name", () => {
  const source = `# user comment\nname: existing-project\nservices:\n  app:\n    image: node:22 # keep this\n`;
  const result = mergeComposeDocument(source, fragment);

  assert.match(result.content, /# user comment/);
  assert.match(result.content, /image: node:22 # keep this/);
  assert.match(result.content, /name: existing-project/);
  assert.match(result.content, /postgres-db:/);
});

test("reports service, volume, and published-port conflicts", () => {
  const source = `services:\n  postgres-db:\n    image: busybox\n  app:\n    image: node:22\n    ports:\n      - published: 6969\n        target: 3000\nvolumes:\n  demo-postgres-data:\n`;

  assert.throws(
    () => mergeComposeDocument(source, fragment),
    (error: unknown) => {
      assert.ok(error instanceof ComposeConflictError);
      assert.equal(error.conflicts.length, 3);
      return true;
    },
  );
});

test("finds canonical Compose names before legacy names", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "create-docker-db-"));

  try {
    fs.writeFileSync(
      path.join(directory, "docker-compose.yml"),
      "services: {}\n",
    );
    fs.writeFileSync(path.join(directory, "compose.yaml"), "services: {}\n");

    assert.equal(
      findComposeFile(directory),
      path.join(directory, "compose.yaml"),
    );
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
