import mysqlTemplate from "../templates/mysql.docker-compose.yml";
import postgresTemplate from "../templates/postgres.docker-compose.yml";
import redisTemplate from "../templates/redis.docker-compose.yml";

export type Database = "postgres" | "mysql" | "redis";

const templates: Record<Database, string> = {
  mysql: mysqlTemplate,
  postgres: postgresTemplate,
  redis: redisTemplate,
};

export function generateDockerCompose(
  selectedDatabase: Database,
  selectedProjectName: string,
): string {
  return templates[selectedDatabase].replace(
    /\$\{selectedProjectName\}/g,
    () => selectedProjectName,
  );
}
