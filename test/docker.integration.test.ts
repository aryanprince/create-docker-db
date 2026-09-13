import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

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

async function checkHttp(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const request = http.get(url, (response) => {
      response.resume();
      finish(
        response.statusCode !== undefined &&
          response.statusCode >= 200 &&
          response.statusCode < 400,
      );
    });

    request.setTimeout(2_000, () => {
      request.destroy();
      finish(false);
    });
    request.once("error", () => finish(false));
  });
}

async function waitForHttp(url: string, timeout = 60_000): Promise<void> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await checkHttp(url)) return;
    await delay(500);
  }

  throw new Error(`${url} did not become ready within ${timeout}ms.`);
}

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
      reservedPorts.add(config.hostPort);
      if (config.adminUi) {
        config.adminPort = await findAvailablePort(46_000, reservedPorts);
        reservedPorts.add(config.adminPort);
      }
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

      await Promise.all(setup.adminUrls.map(({ url }) => waitForHttp(url)));

      const ps = spawnSync(
        "docker",
        ["compose", "-f", composePath, "ps", "--status", "running", "-q"],
        { encoding: "utf8" },
      );
      const runningContainers = ps.stdout.trim().split(/\r?\n/).filter(Boolean);
      assert.equal(
        runningContainers.length,
        Object.keys(setup.fragment.services).length,
      );
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
