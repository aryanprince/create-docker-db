import fs from "fs";
import path from "path";

export type RemoteProviderId =
  "turso" | "planetscale-mysql" | "planetscale-postgres";

export interface RemoteConnectionProfile {
  id: RemoteProviderId;
  label: string;
  variables: Record<string, string>;
  instructions: string[];
}

export interface EnvMergeResult {
  content: string;
  added: string[];
  existing: string[];
}

function shellArgument(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function createRemoteConnectionProfile(
  id: RemoteProviderId,
  databaseName: string,
  branchName = "main",
): RemoteConnectionProfile {
  if (!databaseName.trim()) throw new Error("Enter an existing database name.");

  if (id === "turso") {
    return {
      id,
      label: "Turso",
      variables: {
        TURSO_DATABASE_URL: "libsql://your-database-your-organization.turso.io",
        TURSO_AUTH_TOKEN: "replace-with-a-turso-auth-token",
      },
      instructions: [
        `Get the URL: turso db show ${shellArgument(databaseName)} --url`,
        `Create a token: turso db tokens create ${shellArgument(databaseName)}`,
        "Put those values in your local .env file. Do not commit the token.",
      ],
    };
  }

  const engine = id === "planetscale-mysql" ? "MySQL" : "PostgreSQL";
  const instructions = [
    `Copy the ${engine} SSL connection string from PlanetScale into PLANETSCALE_DATABASE_URL in your local .env file.`,
    "Do not commit the connection string or password.",
  ];

  if (id === "planetscale-mysql") {
    instructions.unshift(
      `Optional local proxy: pscale connect ${shellArgument(databaseName)} ${shellArgument(branchName)} --execute-env-url PLANETSCALE_DATABASE_URL`,
    );
  }

  return {
    id,
    label: `PlanetScale ${engine}`,
    variables: {
      PLANETSCALE_DATABASE_URL:
        id === "planetscale-mysql"
          ? "mysql://username:password@host/database?sslaccept=strict"
          : "postgresql://username:password@host:5432/postgres?sslmode=verify-full&sslrootcert=system",
    },
    instructions,
  };
}

export function mergeEnvExample(
  source: string,
  profile: RemoteConnectionProfile,
): EnvMergeResult {
  const existingKeys = new Set<string>();

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match?.[1]) existingKeys.add(match[1]);
  }

  const added: string[] = [];
  const existing: string[] = [];
  const entries: string[] = [];

  for (const [key, value] of Object.entries(profile.variables)) {
    if (existingKeys.has(key)) {
      existing.push(key);
    } else {
      added.push(key);
      entries.push(`${key}=${value}`);
    }
  }

  if (entries.length === 0) return { content: source, added, existing };

  const separator = source.length > 0 && !source.endsWith("\n") ? "\n" : "";
  const leadingBreak = source.length > 0 ? "\n" : "";
  const content = `${source}${separator}${leadingBreak}# create-docker-db: ${profile.label}\n${entries.join("\n")}\n`;

  return { content, added, existing };
}

export function writeEnvExampleAtomically(
  directory: string,
  content: string,
): string {
  const filePath = path.join(directory, ".env.example");
  const temporaryPath = path.join(
    directory,
    `.env.example.${process.pid}.${Date.now()}.tmp`,
  );
  const mode = fs.existsSync(filePath)
    ? fs.statSync(filePath).mode & 0o777
    : 0o644;

  try {
    fs.writeFileSync(temporaryPath, content, { encoding: "utf8", mode });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }

  return filePath;
}
