import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { isMap, parseDocument } from "yaml";

export const composeFileNames = [
  "compose.yaml",
  "compose.yml",
  "docker-compose.yaml",
  "docker-compose.yml",
] as const;

export interface ComposeFragment {
  projectName: string;
  services: Record<string, unknown>;
  volumes?: Record<string, unknown>;
}

export interface ComposeMergeResult {
  content: string;
  addedServices: string[];
  addedVolumes: string[];
}

export class ComposeConflictError extends Error {
  constructor(public readonly conflicts: string[]) {
    super(
      `Docker Compose conflicts:\n${conflicts.map((item) => `- ${item}`).join("\n")}`,
    );
    this.name = "ComposeConflictError";
  }
}

export function findComposeFile(directory: string): string | undefined {
  return composeFileNames
    .map((fileName) => path.join(directory, fileName))
    .find((filePath) => fs.existsSync(filePath));
}

function getPublishedPort(port: unknown): string | undefined {
  if (typeof port === "number") return String(port);

  if (typeof port === "object" && port !== null && "published" in port) {
    const published = (port as { published?: unknown }).published;
    return typeof published === "number" || typeof published === "string"
      ? String(published)
      : undefined;
  }

  if (typeof port !== "string") return undefined;

  const withoutProtocol = port.split("/")[0] ?? port;
  const parts = withoutProtocol.split(":");

  if (parts.length === 1) return undefined;
  return parts.at(-2)?.replace(/^\[|\]$/g, "");
}

function collectPublishedPorts(services: Record<string, unknown>): Set<string> {
  const ports = new Set<string>();

  for (const service of Object.values(services)) {
    if (
      typeof service !== "object" ||
      service === null ||
      !("ports" in service)
    ) {
      continue;
    }

    const servicePorts = (service as { ports?: unknown }).ports;
    if (!Array.isArray(servicePorts)) continue;

    for (const port of servicePorts) {
      const published = getPublishedPort(port);
      if (published) ports.add(published);
    }
  }

  return ports;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function mergeComposeDocument(
  source: string | undefined,
  fragment: ComposeFragment,
): ComposeMergeResult {
  const document = parseDocument(source ?? "{}\n", {
    prettyErrors: true,
    uniqueKeys: true,
  });

  if (document.errors.length > 0) {
    throw new Error(
      `Could not parse the existing Docker Compose file:\n${document.errors.join("\n")}`,
    );
  }

  if (!isMap(document.contents)) {
    throw new Error("The Docker Compose document must contain a YAML mapping.");
  }

  if (source === undefined) document.contents.flow = false;

  const current = asRecord(document.toJS());
  const currentServices = asRecord(current.services);
  const currentVolumes = asRecord(current.volumes);
  const existingPorts = collectPublishedPorts(currentServices);
  const fragmentPorts = collectPublishedPorts(fragment.services);
  const conflicts: string[] = [];

  for (const serviceName of Object.keys(fragment.services)) {
    if (serviceName in currentServices) {
      conflicts.push(`service \`${serviceName}\` already exists`);
    }
  }

  for (const volumeName of Object.keys(fragment.volumes ?? {})) {
    if (volumeName in currentVolumes) {
      conflicts.push(`volume \`${volumeName}\` already exists`);
    }
  }

  for (const port of fragmentPorts) {
    if (existingPorts.has(port)) {
      conflicts.push(`host port \`${port}\` is already published`);
    }
  }

  if (conflicts.length > 0) throw new ComposeConflictError(conflicts);

  if (!("services" in current)) {
    document.set("services", document.createNode({}));
  }

  for (const [serviceName, service] of Object.entries(fragment.services)) {
    document.setIn(["services", serviceName], service);
  }

  const volumes = fragment.volumes ?? {};
  if (Object.keys(volumes).length > 0 && !("volumes" in current)) {
    document.set("volumes", document.createNode({}));
  }

  for (const [volumeName, volume] of Object.entries(volumes)) {
    document.setIn(["volumes", volumeName], volume);
  }

  if (source === undefined && !("name" in current)) {
    document.set("name", fragment.projectName);
  }

  return {
    content: document.toString({ lineWidth: 0 }),
    addedServices: Object.keys(fragment.services),
    addedVolumes: Object.keys(volumes),
  };
}

export function validateComposeFile(filePath: string): void {
  const result = spawnSync(
    "docker",
    ["compose", "-f", filePath, "config", "--quiet"],
    { encoding: "utf8" },
  );

  if (result.error) {
    throw new Error(`Could not run Docker Compose: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const details = result.stderr.trim() || result.stdout.trim();
    throw new Error(
      `Docker Compose validation failed${details ? `:\n${details}` : "."}`,
    );
  }
}

export function writeValidatedComposeFile(
  filePath: string,
  content: string,
): void {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    fs.writeFileSync(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
    validateComposeFile(temporaryPath);
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}
