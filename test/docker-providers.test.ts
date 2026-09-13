import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createDefaultDockerConfig,
  generateDockerSetup,
} from "../src/providers/docker";
import { mergeComposeDocument } from "../src/utils/compose-file";

test("generates healthy persistent PostgreSQL and Adminer services", () => {
  const config = createDefaultDockerConfig("postgres", "demo");
  const setup = generateDockerSetup("demo", [config]);
  const content = mergeComposeDocument(undefined, setup.fragment).content;

  assert.match(content, /image: postgres:17/);
  assert.match(content, /pg_isready/);
  assert.match(content, /\/var\/lib\/postgresql\/data/);
  assert.match(content, /image: adminer:6/);
  assert.match(content, /condition: service_healthy/);
  assert.equal(
    setup.connectionUrls[0]?.url,
    "postgresql://dev:dev@127.0.0.1:5432/demo",
  );
});

test("generates multiple databases with distinct default ports", () => {
  const setup = generateDockerSetup("demo", [
    createDefaultDockerConfig("postgres", "demo"),
    createDefaultDockerConfig("redis", "demo"),
  ]);
  const content = mergeComposeDocument(undefined, setup.fragment).content;

  assert.match(content, /127\.0\.0\.1:5432:5432/);
  assert.match(content, /127\.0\.0\.1:6379:6379/);
  assert.match(content, /redis-server/);
  assert.match(content, /--appendonly/);
  assert.equal(setup.connectionUrls.length, 2);
});

test("omits volumes and admin UI when persistence and UI are disabled", () => {
  const config = {
    ...createDefaultDockerConfig("mysql", "demo"),
    persistence: false,
    adminUi: false,
  };
  const setup = generateDockerSetup("demo", [config]);
  const content = mergeComposeDocument(undefined, setup.fragment).content;

  assert.doesNotMatch(content, /^volumes:/m);
  assert.doesNotMatch(content, /adminer/);
});

test("generates an authenticated MongoDB service without deprecated admin UI", () => {
  const config = createDefaultDockerConfig("mongodb", "demo");
  const setup = generateDockerSetup("demo", [config]);
  const content = mergeComposeDocument(undefined, setup.fragment).content;

  assert.match(content, /image: mongo:8\.0/);
  assert.match(content, /MONGO_INITDB_ROOT_USERNAME/);
  assert.match(content, /mongosh/);
  assert.match(content, /\/data\/db/);
  assert.doesNotMatch(content, /mongo-express/);
  assert.equal(
    setup.connectionUrls[0]?.url,
    "mongodb://dev:dev@127.0.0.1:27017/demo?authSource=admin",
  );
});

test("matches the reviewed all-provider Compose snapshot", () => {
  const setup = generateDockerSetup(
    "example",
    (["postgres", "mysql", "redis", "mongodb"] as const).map((id) =>
      createDefaultDockerConfig(id, "example"),
    ),
  );
  const content = mergeComposeDocument(undefined, setup.fragment).content;
  const snapshot = fs.readFileSync(
    path.join(process.cwd(), "test/fixtures/all-databases.compose.yaml"),
    "utf8",
  );

  assert.equal(content, snapshot);
});
