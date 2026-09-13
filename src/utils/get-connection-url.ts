import type { Database } from "./generate-docker-compose-file";

export function getConnectionUrl(
  selectedDatabase: Database,
  selectedProjectName: string,
): string {
  const databaseName = encodeURIComponent(selectedProjectName);

  switch (selectedDatabase) {
    case "postgres":
      return `postgresql://dev:dev@localhost:6969/${databaseName}`;
    case "mysql":
      return `mysql://dev:dev@localhost:6969/${databaseName}`;
    case "redis":
      return `redis://localhost:6969`;
  }
}
