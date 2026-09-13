import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createDefaultDockerConfig,
  generateDockerSetup,
  type DockerProviderId,
} from "../src/providers/docker";
import {
  mergeComposeDocument,
  validateComposeFile,
} from "../src/utils/compose-file";
import { findAvailablePort } from "../src/utils/ports";

const runDockerTests = process.env.RUN_DOCKER_TESTS === "1";

test(
  "starts every generated database and reaches healthy state",
  { skip: !runDockerTests, timeout: 600_000 },
  async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "create-docker-db-integration-"),
    );
    const composePath = path.join(directory, "compose.yaml");
    const reservedPorts = new Set<number>();
    const providerIds: DockerProviderId[] = [
      "postgres",
      "mysql",
      "redis",
      "mongodb",
    ];
    const configs = [];

    for (const id of providerIds) {
      const config = createDefaultDockerConfig(id, "integration-test");
      config.hostPort = await findAvailablePort(45_000, reservedPorts);
      config.adminUi = false;
      reservedPorts.add(config.hostPort);
      configs.push(config);
    }

    const setup = generateDockerSetup("integration-test", configs);
    const content = mergeComposeDocument(undefined, setup.fragment).content;
    fs.writeFileSync(composePath, content, "utf8");

    try {
      validateComposeFile(composePath);
      const up = spawnSync(
        "docker",
        [
          "compose",
          "-f",
          composePath,
          "up",
          "-d",
          "--wait",
          "--wait-timeout",
          "240",
        ],
        { encoding: "utf8", timeout: 300_000 },
      );

      assert.equal(
        up.status,
        0,
        `Docker databases did not become healthy:\n${up.stderr || up.stdout}`,
      );

      const ps = spawnSync(
        "docker",
        ["compose", "-f", composePath, "ps", "--status", "running", "-q"],
        { encoding: "utf8" },
      );
      const runningContainers = ps.stdout.trim().split(/\r?\n/).filter(Boolean);
      assert.equal(runningContainers.length, providerIds.length);
    } finally {
      spawnSync(
        "docker",
        ["compose", "-f", composePath, "down", "--volumes", "--remove-orphans"],
        { encoding: "utf8", timeout: 120_000 },
      );
      fs.rmSync(directory, { recursive: true });
    }
  },
);
