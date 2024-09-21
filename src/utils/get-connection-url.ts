export function getConnectionUrl(
  selectedDatabase: string,
  selectedProjectName: string,
): string {
  switch (selectedDatabase) {
    case "postgres":
      return `postgresql://dev:dev@localhost:6969/${selectedProjectName}`;
    case "mysql":
      return `mysql://dev:dev@localhost:6969/${selectedProjectName}`;
    default:
      throw new Error("Database not supported");
  }
}
