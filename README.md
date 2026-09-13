# 📦 create-docker-db

A CLI for creating local development databases and configuring hosted database connections.

It supports PostgreSQL, MySQL, Redis, MongoDB, SQLite, local libSQL, Turso, and PlanetScale.

![Screenshot showcasing the `create-docker-db` CLI tool](https://github.com/user-attachments/assets/30df32e3-d314-4594-94e9-33cda10702c4)

## 🚀 Usage

```bash
npx create-docker-db # or bunx create-docker-db
```

Choose one of these setup modes:

- Docker databases: select one or more of PostgreSQL, MySQL, Redis, and MongoDB
- SQLite file: create or reuse a private local database file
- Local libSQL HTTP server: create a database file and run it with `turso dev`
- Hosted connection: add safe `.env.example` placeholders and instructions for Turso or PlanetScale

Docker mode discovers existing Compose files, previews additive changes, checks names and ports for conflicts, validates the result with `docker compose config`, and only then replaces the file atomically. Existing services, comments, volumes, and project names are preserved.

Each Docker provider can be configured with an image version, service name, host port, database name, development credentials, persistence setting, and supported admin UI.

## 🎯 Roadmap

### Shipped

- [x] Generate Docker Compose services for PostgreSQL, MySQL, and Redis
- [x] Display copy-pastable connection URLs for generated databases
- [x] Scope generated resources with a project-based Compose name
- [x] Protect existing Docker Compose files from accidental overwrites
- [x] Publish GitHub and npm releases through a manually triggered release workflow

### Phase 1: Safe Compose foundations

- [x] Discover `compose.yaml`, `compose.yml`, and legacy Docker Compose filenames before generating a file
- [x] Add database services to existing Compose files without overwriting user configuration
- [x] Preserve the existing project name and detect service, volume, and port conflicts before writing
- [x] Preview changes and write atomically, with the original file left intact if validation fails
- [x] Allow multiple compatible databases to be selected together, including Redis with PostgreSQL or MySQL
- [x] Allocate available, non-conflicting host ports and display every generated connection URL
- [x] Add configuration prompts for image version, host port, database name, credentials, persistence, and optional admin UI
- [x] Prefer Compose project and service names over fixed `container_name` values
- [x] Add provider health checks and make admin UIs wait for healthy databases
- [x] Validate every generated or modified file with `docker compose config`
- [x] Add unit, snapshot, and container-backed integration tests for every Docker provider

### Phase 2: More local databases

- [x] Add MongoDB using the Docker Official Image, a named volume, authentication, a health check, and a copy-pastable URL
- [x] Add SQLite file mode without requiring Docker
- [x] Add local libSQL HTTP mode through `turso dev --db-file`, with clear install and start instructions

### Phase 3: Hosted and HTTP database connections

- [x] Add a connection-profile flow for existing Turso databases
- [x] Add a connection-profile flow for existing PlanetScale MySQL and PostgreSQL databases
- [x] Generate `.env.example` placeholders and framework-neutral setup instructions without saving live tokens or passwords
- [x] Generate tailored Turso and PlanetScale CLI commands for local development workflows
- [x] Keep hosted connections separate from Docker Compose generation

### Template quality bar

- [x] Use official database images and documented initialization variables and data paths
- [x] Bind development ports to `127.0.0.1` by default
- [x] Pin supported image release lines instead of using `latest`
- [x] Persist data in named volumes unless the user opts out
- [x] Include provider-native health checks and actionable connection details
- [x] Treat generated credentials as local-development defaults and support environment overrides

## 📖 Template references

The generated configurations follow the official documentation for the [PostgreSQL image](https://hub.docker.com/_/postgres), [MySQL image](https://hub.docker.com/_/mysql), [Redis image](https://hub.docker.com/_/redis), [MongoDB image](https://hub.docker.com/_/mongo), [Docker Compose file](https://docs.docker.com/reference/compose-file/), [Turso local development](https://docs.turso.tech/local-development), [PlanetScale MySQL connections](https://planetscale.com/docs/vitess/connecting/connection-strings), and [PlanetScale PostgreSQL connections](https://planetscale.com/docs/postgres/connecting).
