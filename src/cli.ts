import * as p from "@clack/prompts";
import { Command } from "commander";
import fs from "fs";
import path from "path";

import packageJson from "../package.json";
import {
  createDefaultDockerConfig,
  dockerProviders,
  generateDockerSetup,
  type DockerProviderConfig,
  type DockerProviderId,
} from "./providers/docker";
import {
  ComposeConflictError,
  findComposeFile,
  mergeComposeDocument,
  writeValidatedComposeFile,
} from "./utils/compose-file";

const projectNamePattern = /^[a-z0-9][a-z0-9_-]*$/;
const serviceNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

function normalizeProjectName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .slice(0, 63);

  return normalized || "dev-db";
}

function cancel(): never {
  p.cancel("Operation cancelled.");
  process.exit(0);
}

async function textPrompt(
  options: Parameters<typeof p.text>[0],
): Promise<string> {
  const value = await p.text(options);
  if (p.isCancel(value)) cancel();
  return value;
}

async function confirmPrompt(
  message: string,
  initialValue: boolean,
): Promise<boolean> {
  const value = await p.confirm({ message, initialValue });
  if (p.isCancel(value)) cancel();
  return value;
}

function portValidator(value: string | undefined): string | undefined {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return "Enter a port between 1 and 65535.";
  }
}

async function customizeDockerConfig(
  config: DockerProviderConfig,
): Promise<DockerProviderConfig> {
  const provider = dockerProviders[config.id];
  const customize = await confirmPrompt(`Customize ${provider.label}?`, false);

  if (!customize) return config;

  const serviceName = await textPrompt({
    message: `${provider.label} service name`,
    defaultValue: config.serviceName,
    validate: (value) => {
      if (!value || !serviceNamePattern.test(value)) {
        return "Use letters, numbers, dots, hyphens, or underscores.";
      }
    },
  });
  const image = await textPrompt({
    message: `${provider.label} image`,
    defaultValue: config.image,
    validate: (value) => (!value ? "Enter an image and tag." : undefined),
  });
  const hostPort = Number(
    await textPrompt({
      message: `${provider.label} host port`,
      defaultValue: String(config.hostPort),
      validate: portValidator,
    }),
  );
  let databaseName = config.databaseName;
  let username = config.username;
  let password = config.password;

  if (provider.supportsCredentials) {
    databaseName = await textPrompt({
      message: `${provider.label} database name`,
      defaultValue: config.databaseName,
      validate: (value) => (!value ? "Enter a database name." : undefined),
    });
    username = await textPrompt({
      message: `${provider.label} development username`,
      defaultValue: config.username,
      validate: (value) => (!value ? "Enter a username." : undefined),
    });
    password = await textPrompt({
      message: `${provider.label} development password`,
      defaultValue: config.password,
      validate: (value) => (!value ? "Enter a password." : undefined),
    });
  }

  const persistence = await confirmPrompt(
    `Persist ${provider.label} data in a named volume?`,
    config.persistence,
  );
  const adminUi = provider.supportsAdminUi
    ? await confirmPrompt(
        `Include the ${provider.label} admin UI?`,
        config.adminUi,
      )
    : false;
  let adminPort = config.adminPort;

  if (adminUi) {
    adminPort = Number(
      await textPrompt({
        message: `${provider.label} admin UI port`,
        defaultValue: String(config.adminPort),
        validate: portValidator,
      }),
    );
  }

  return {
    ...config,
    serviceName,
    image,
    hostPort,
    databaseName,
    username,
    password,
    persistence,
    adminUi,
    adminPort,
  };
}

function assertUniqueConfiguration(configs: DockerProviderConfig[]): void {
  const names = new Set<string>();
  const ports = new Set<number>();

  for (const config of configs) {
    const serviceNames = [
      config.serviceName,
      ...(config.adminUi
        ? [config.id === "redis" ? "redis-insight" : `${config.id}-adminer`]
        : []),
    ];
    const publishedPorts = [
      config.hostPort,
      ...(config.adminUi ? [config.adminPort] : []),
    ];

    for (const name of serviceNames) {
      if (names.has(name))
        throw new Error(`Service name \`${name}\` is duplicated.`);
      names.add(name);
    }

    for (const port of publishedPorts) {
      if (ports.has(port))
        throw new Error(`Host port \`${port}\` is duplicated.`);
      ports.add(port);
    }
  }
}

async function setupDockerDatabases(projectName: string): Promise<void> {
  const selection = await p.multiselect<
    { value: DockerProviderId; label: string }[],
    DockerProviderId
  >({
    message: "Which databases would you like to add?",
    options: Object.values(dockerProviders).map((provider) => ({
      value: provider.id,
      label: provider.label,
    })),
    initialValues: ["postgres"],
    required: true,
  });
  if (p.isCancel(selection)) cancel();

  const configs: DockerProviderConfig[] = [];
  for (const id of selection) {
    configs.push(
      await customizeDockerConfig(createDefaultDockerConfig(id, projectName)),
    );
  }
  assertUniqueConfiguration(configs);

  const setup = generateDockerSetup(projectName, configs);
  const existingPath = findComposeFile(process.cwd());
  const composePath = existingPath ?? path.join(process.cwd(), "compose.yaml");
  const source = existingPath
    ? fs.readFileSync(existingPath, "utf8")
    : undefined;
  const merged = mergeComposeDocument(source, setup.fragment);

  p.note(
    [
      `File: ${path.basename(composePath)}`,
      `Services: ${merged.addedServices.join(", ")}`,
      merged.addedVolumes.length > 0
        ? `Volumes: ${merged.addedVolumes.join(", ")}`
        : "Volumes: none",
    ].join("\n"),
    existingPath ? "Compose changes" : "New Compose file",
  );

  const approved = await confirmPrompt(
    existingPath
      ? `Add these services to ${path.basename(existingPath)}?`
      : "Create compose.yaml?",
    true,
  );
  if (!approved) cancel();

  writeValidatedComposeFile(composePath, merged.content);

  const details = [
    "Run: docker compose up -d",
    "",
    "Connections:",
    ...setup.connectionUrls.map(({ label, url }) => `${label}: ${url}`),
    ...(setup.adminUrls.length > 0
      ? [
          "",
          "Admin UIs:",
          ...setup.adminUrls.map(({ label, url }) => `${label}: ${url}`),
        ]
      : []),
  ];
  p.outro(`Docker databases are ready.\n\n${details.join("\n")}`);
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name("create-docker-db")
    .description(
      "Create local development databases and configure hosted database connections",
    )
    .version(packageJson.version)
    .action(async () => {
      try {
        console.log("\n");
        p.intro("create-docker-db");

        const currentDirectory = normalizeProjectName(
          path.basename(process.cwd()),
        );
        const projectName = await textPrompt({
          message: "Enter your project name",
          placeholder: currentDirectory,
          defaultValue: currentDirectory,
          validate: (value) => {
            const name = value || currentDirectory;
            if (!projectNamePattern.test(name)) {
              return "Use lowercase letters, numbers, hyphens, or underscores, starting with a letter or number.";
            }
            if (name.length > 63) {
              return "Project names must be 63 characters or fewer.";
            }
          },
        });

        await setupDockerDatabases(projectName);
      } catch (error) {
        p.cancel(
          error instanceof ComposeConflictError || error instanceof Error
            ? error.message
            : "Something went wrong.",
        );
        process.exitCode = 1;
      }
    });

  await program.parseAsync(argv);
}
