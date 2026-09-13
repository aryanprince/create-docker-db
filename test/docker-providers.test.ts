import assert from "node:assert/strict";
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
