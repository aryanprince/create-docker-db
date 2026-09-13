import fs from "fs";
import path from "path";

export type LocalProviderId = "sqlite" | "libsql";

export interface LocalDatabaseSetup {
  filePath: string;
  connectionUrl: string;
  startCommand?: string;
  created: boolean;
}

export function resolveLocalDatabasePath(
  directory: string,
  fileName: string,
): string {
  if (!fileName.trim()) throw new Error("Enter a database filename.");

  const directoryPath = path.resolve(directory);
  const filePath = path.resolve(directoryPath, fileName);
  const relative = path.relative(directoryPath, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("The database file must stay inside the current project.");
  }

  return filePath;
}

export function createLocalDatabase(
  directory: string,
  fileName: string,
  provider: LocalProviderId,
): LocalDatabaseSetup {
  const filePath = resolveLocalDatabasePath(directory, fileName);
  const created = !fs.existsSync(filePath);

  if (created) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const descriptor = fs.openSync(filePath, "wx", 0o600);
    fs.closeSync(descriptor);
  }

  const relativePath = path
    .relative(directory, filePath)
    .split(path.sep)
    .join("/");

  return {
    filePath,
    connectionUrl:
      provider === "sqlite"
        ? `file:./${relativePath}`
        : "http://127.0.0.1:8080",
    startCommand:
      provider === "libsql"
        ? `turso dev --db-file ${JSON.stringify(relativePath)}`
        : undefined,
    created,
  };
}

export function addGitignoreEntry(directory: string, entry: string): boolean {
  const gitignorePath = path.join(directory, ".gitignore");
  const source = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";
  const lines = source.split(/\r?\n/);

  if (lines.includes(entry)) return false;

  const separator = source.length > 0 && !source.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(gitignorePath, `${source}${separator}${entry}\n`, "utf8");
  return true;
}
