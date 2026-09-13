import type { ComposeFragment } from "../utils/compose-file";

export type DockerProviderId = "postgres" | "mysql" | "redis" | "mongodb";

export interface DockerProviderDefinition {
  id: DockerProviderId;
  label: string;
  defaultImage: string;
  containerPort: number;
  defaultHostPort: number;
  defaultAdminPort: number;
  supportsCredentials: boolean;
  supportsAdminUi: boolean;
}

export interface DockerProviderConfig {
  id: DockerProviderId;
  image: string;
  serviceName: string;
  hostPort: number;
  databaseName: string;
  username: string;
  password: string;
  persistence: boolean;
  adminUi: boolean;
  adminPort: number;
}

export interface GeneratedDockerSetup {
  fragment: ComposeFragment;
  connectionUrls: Array<{ label: string; url: string }>;
  adminUrls: Array<{ label: string; url: string }>;
}

export const dockerProviders: Record<
  DockerProviderId,
  DockerProviderDefinition
> = {
  postgres: {
    id: "postgres",
    label: "PostgreSQL",
    defaultImage: "postgres:17",
    containerPort: 5432,
    defaultHostPort: 5432,
    defaultAdminPort: 8069,
    supportsCredentials: true,
    supportsAdminUi: true,
  },
  mysql: {
    id: "mysql",
    label: "MySQL",
    defaultImage: "mysql:8.4",
    containerPort: 3306,
    defaultHostPort: 3306,
    defaultAdminPort: 8070,
    supportsCredentials: true,
    supportsAdminUi: true,
  },
  redis: {
    id: "redis",
    label: "Redis",
    defaultImage: "redis:8",
    containerPort: 6379,
    defaultHostPort: 6379,
    defaultAdminPort: 8071,
    supportsCredentials: false,
    supportsAdminUi: true,
  },
  mongodb: {
    id: "mongodb",
    label: "MongoDB",
    defaultImage: "mongo:8.0",
    containerPort: 27017,
    defaultHostPort: 27017,
    defaultAdminPort: 8072,
    supportsCredentials: true,
    supportsAdminUi: false,
  },
};

export function createDefaultDockerConfig(
  id: DockerProviderId,
  projectName: string,
): DockerProviderConfig {
  const provider = dockerProviders[id];

  return {
    id,
    image: provider.defaultImage,
    serviceName: `${id}-db`,
    hostPort: provider.defaultHostPort,
    databaseName: projectName,
    username: "dev",
    password: "dev",
    persistence: true,
    adminUi: provider.supportsAdminUi,
    adminPort: provider.defaultAdminPort,
  };
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

function environmentDefault(name: string, value: string): string {
  return `\${${name}:-${value}}`;
}

function persistenceVolume(
  volumeName: string,
  containerPath: string,
  enabled: boolean,
): string[] | undefined {
  return enabled ? [`${volumeName}:${containerPath}`] : undefined;
}

function healthcheck(test: string[]): Record<string, unknown> {
  return {
    test,
    interval: "5s",
    timeout: "5s",
    retries: 10,
    start_period: "10s",
  };
}

function addAdminer(
  services: Record<string, unknown>,
  config: DockerProviderConfig,
): { label: string; url: string } | undefined {
  if (!config.adminUi || config.id === "redis" || config.id === "mongodb") {
    return undefined;
  }

  const serviceName = `${config.id}-adminer`;
  services[serviceName] = {
    image: "adminer:6",
    restart: "unless-stopped",
    depends_on: {
      [config.serviceName]: { condition: "service_healthy" },
    },
    environment: {
      ADMINER_DEFAULT_SERVER: config.serviceName,
    },
    ports: [`127.0.0.1:${config.adminPort}:8080`],
  };

  return {
    label: `${dockerProviders[config.id].label} Adminer`,
    url: `http://127.0.0.1:${config.adminPort}`,
  };
}

export function generateDockerSetup(
  projectName: string,
  configs: DockerProviderConfig[],
): GeneratedDockerSetup {
  if (configs.length === 0) {
    throw new Error("Select at least one Docker database provider.");
  }

  const services: Record<string, unknown> = {};
  const volumes: Record<string, unknown> = {};
  const connectionUrls: GeneratedDockerSetup["connectionUrls"] = [];
  const adminUrls: GeneratedDockerSetup["adminUrls"] = [];

  for (const config of configs) {
    const provider = dockerProviders[config.id];
    const volumeName = `${projectName}-${config.id}-data`;
    const common = {
      image: config.image,
      restart: "unless-stopped",
      ports: [`127.0.0.1:${config.hostPort}:${provider.containerPort}`],
    };

    if (config.id === "postgres") {
      services[config.serviceName] = {
        ...common,
        shm_size: "128mb",
        environment: {
          POSTGRES_DB: environmentDefault("POSTGRES_DB", config.databaseName),
          POSTGRES_USER: environmentDefault("POSTGRES_USER", config.username),
          POSTGRES_PASSWORD: environmentDefault(
            "POSTGRES_PASSWORD",
            config.password,
          ),
        },
        volumes: persistenceVolume(
          volumeName,
          "/var/lib/postgresql/data",
          config.persistence,
        ),
        healthcheck: healthcheck([
          "CMD-SHELL",
          "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB",
        ]),
      };
      connectionUrls.push({
        label: provider.label,
        url: `postgresql://${encode(config.username)}:${encode(config.password)}@127.0.0.1:${config.hostPort}/${encode(config.databaseName)}`,
      });
    }

    if (config.id === "mysql") {
      services[config.serviceName] = {
        ...common,
        environment: {
          MYSQL_DATABASE: environmentDefault(
            "MYSQL_DATABASE",
            config.databaseName,
          ),
          MYSQL_ROOT_PASSWORD: environmentDefault(
            "MYSQL_ROOT_PASSWORD",
            "root",
          ),
          MYSQL_USER: environmentDefault("MYSQL_USER", config.username),
          MYSQL_PASSWORD: environmentDefault("MYSQL_PASSWORD", config.password),
        },
        volumes: persistenceVolume(
          volumeName,
          "/var/lib/mysql",
          config.persistence,
        ),
        healthcheck: healthcheck([
          "CMD-SHELL",
          "mysqladmin ping -h localhost -u root -p$$MYSQL_ROOT_PASSWORD --silent",
        ]),
      };
      connectionUrls.push({
        label: provider.label,
        url: `mysql://${encode(config.username)}:${encode(config.password)}@127.0.0.1:${config.hostPort}/${encode(config.databaseName)}`,
      });
    }

    if (config.id === "redis") {
      services[config.serviceName] = {
        ...common,
        command: config.persistence
          ? ["redis-server", "--appendonly", "yes"]
          : undefined,
        volumes: persistenceVolume(volumeName, "/data", config.persistence),
        healthcheck: healthcheck(["CMD", "redis-cli", "ping"]),
      };
      connectionUrls.push({
        label: provider.label,
        url: `redis://127.0.0.1:${config.hostPort}`,
      });

      if (config.adminUi) {
        services[`${config.id}-insight`] = {
          image: "redis/redisinsight:3.8.0",
          restart: "unless-stopped",
          depends_on: {
            [config.serviceName]: { condition: "service_healthy" },
          },
          ports: [`127.0.0.1:${config.adminPort}:5540`],
        };
        adminUrls.push({
          label: "Redis Insight",
          url: `http://127.0.0.1:${config.adminPort}`,
        });
      }
    }

    if (config.id === "mongodb") {
      services[config.serviceName] = {
        ...common,
        environment: {
          MONGO_INITDB_DATABASE: environmentDefault(
            "MONGO_INITDB_DATABASE",
            config.databaseName,
          ),
          MONGO_INITDB_ROOT_USERNAME: environmentDefault(
            "MONGO_INITDB_ROOT_USERNAME",
            config.username,
          ),
          MONGO_INITDB_ROOT_PASSWORD: environmentDefault(
            "MONGO_INITDB_ROOT_PASSWORD",
            config.password,
          ),
        },
        volumes: persistenceVolume(volumeName, "/data/db", config.persistence),
        healthcheck: healthcheck([
          "CMD-SHELL",
          `mongosh --quiet --host localhost --username "$$MONGO_INITDB_ROOT_USERNAME" --password "$$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "quit(db.adminCommand('ping').ok ? 0 : 2)"`,
        ]),
      };
      connectionUrls.push({
        label: provider.label,
        url: `mongodb://${encode(config.username)}:${encode(config.password)}@127.0.0.1:${config.hostPort}/${encode(config.databaseName)}?authSource=admin`,
      });
    }

    if (config.persistence) volumes[volumeName] = null;

    const adminUrl = addAdminer(services, config);
    if (adminUrl) adminUrls.push(adminUrl);
  }

  return {
    fragment: {
      projectName: `${projectName}-databases`,
      services,
      volumes,
    },
    connectionUrls,
    adminUrls,
  };
}
