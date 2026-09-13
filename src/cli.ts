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
  addGitignoreEntry,
  createLocalDatabase,
  resolveLocalDatabasePath,
  type LocalProviderId,
} from "./providers/local";
import {
  createRemoteConnectionProfile,
  mergeEnvExample,
  writeEnvExampleAtomically,
  type RemoteProviderId,
} from "./providers/remote";
import {
  ComposeConflictError,
  findComposeFile,
  mergeComposeDocument,
  writeValidatedComposeFile,
} from "./utils/compose-file";

const projectNamePattern = /^[a-z0-9][a-z0-9_-]*$/;
const serviceNamePattern = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

type SetupType = "docker" | LocalProviderId | "remote";

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

async function setupLocalDatabase(provider: LocalProviderId): Promise<void> {
  const label = provider === "sqlite" ? "SQLite" : "local libSQL";
  const fileName = await textPrompt({
    message: `${label} database file`,
    defaultValue: "local.db",
    validate: (value) => {
      try {
        resolveLocalDatabasePath(process.cwd(), value ?? "");
      } catch (error) {
        return error instanceof Error
          ? error.message
          : "Invalid database path.";
      }
    },
  });
  const filePath = resolveLocalDatabasePath(process.cwd(), fileName);

  p.note(
    [
      `File: ${path.relative(process.cwd(), filePath)}`,
      provider === "sqlite"
        ? "Connection: file-based SQLite"
        : "Server: Turso CLI on http://127.0.0.1:8080",
    ].join("\n"),
    `${label} setup`,
  );

  const approved = await confirmPrompt(
    fs.existsSync(filePath)
      ? "Use this existing database file?"
      : "Create this database file?",
    true,
  );
  if (!approved) cancel();

  const setup = createLocalDatabase(process.cwd(), fileName, provider);
  const shouldIgnore = await confirmPrompt(
    "Add the database file to .gitignore?",
    true,
  );
  if (shouldIgnore) {
    addGitignoreEntry(
      process.cwd(),
      path.relative(process.cwd(), setup.filePath).split(path.sep).join("/"),
    );
  }

  p.outro(
    [
      `${label} is ready.`,
      "",
      ...(setup.startCommand ? [`Run: ${setup.startCommand}`, ""] : []),
      `Connection: ${setup.connectionUrl}`,
    ].join("\n"),
  );
}

async function setupRemoteConnection(): Promise<void> {
  const provider = await p.select<
    { value: RemoteProviderId; label: string }[],
    RemoteProviderId
  >({
    message: "Which hosted database are you connecting?",
    options: [
      { value: "turso", label: "Turso" },
      { value: "planetscale-mysql", label: "PlanetScale MySQL" },
      { value: "planetscale-postgres", label: "PlanetScale PostgreSQL" },
    ],
    initialValue: "turso",
  });
  if (p.isCancel(provider)) cancel();

  const databaseName = await textPrompt({
    message: "Existing database name",
    validate: (value) =>
      !value?.trim() ? "Enter a database name." : undefined,
  });
  let branchName = "main";

  if (provider === "planetscale-mysql") {
    branchName = await textPrompt({
      message: "PlanetScale branch name",
      defaultValue: "main",
      validate: (value) =>
        !value?.trim() ? "Enter a branch name." : undefined,
    });
  }

  const profile = createRemoteConnectionProfile(
    provider,
    databaseName,
    branchName,
  );
  const envExamplePath = path.join(process.cwd(), ".env.example");
  const source = fs.existsSync(envExamplePath)
    ? fs.readFileSync(envExamplePath, "utf8")
    : "";
  const merged = mergeEnvExample(source, profile);

  p.note(
    [
      "File: .env.example",
      `Add: ${merged.added.join(", ") || "none"}`,
      `Keep existing: ${merged.existing.join(", ") || "none"}`,
      "Live credentials will not be saved.",
    ].join("\n"),
    `${profile.label} connection profile`,
  );

  const approved = await confirmPrompt(
    merged.added.length > 0
      ? "Update .env.example with these placeholders?"
      : "Keep the existing placeholders?",
    true,
  );
  if (!approved) cancel();

  if (merged.added.length > 0) {
    writeEnvExampleAtomically(process.cwd(), merged.content);
  }

  p.outro(
    [
      `${profile.label} connection profile is ready.`,
      "",
      ...profile.instructions,
    ].join("\n"),
  );
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

        const setupType = await p.select<
          { value: SetupType; label: string; hint?: string }[],
          SetupType
        >({
          message: "What would you like to set up?",
          options: [
            {
              value: "docker",
              label: "Docker databases",
              hint: "PostgreSQL, MySQL, Redis, or MongoDB",
            },
            {
              value: "sqlite",
              label: "SQLite file",
              hint: "No Docker or server required",
            },
            {
              value: "libsql",
              label: "Local libSQL HTTP server",
              hint: "Runs with the Turso CLI",
            },
            {
              value: "remote",
              label: "Hosted database connection",
              hint: "Turso or PlanetScale",
            },
          ],
          initialValue: "docker",
        });
        if (p.isCancel(setupType)) cancel();

        if (setupType === "docker") {
          await setupDockerDatabases(projectName);
        } else if (setupType === "remote") {
          await setupRemoteConnection();
        } else {
          await setupLocalDatabase(setupType);
        }
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
