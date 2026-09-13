# 📦 create-docker-db

A CLI to easily create DBs for local development using Docker Compose.

Currently supports PostgreSQL, MySQL, and Redis.

![Screenshot showcasing the `create-docker-db` CLI tool](https://github.com/user-attachments/assets/30df32e3-d314-4594-94e9-33cda10702c4)

## 🚀 Usage

```bash
npx create-docker-db # or bunx create-docker-db
```

## 🎯 Roadmap

### Shipped

- [x] Generate Docker Compose services for PostgreSQL, MySQL, and Redis
- [x] Display copy-pastable connection URLs for generated databases
- [x] Scope generated resources with a project-based Compose name
- [x] Protect existing Docker Compose files from accidental overwrites
- [x] Publish GitHub and npm releases through a manually triggered release workflow

### Phase 1: Safe Compose foundations

- [ ] Discover `compose.yaml`, `compose.yml`, and legacy Docker Compose filenames before generating a file
- [ ] Add database services to existing Compose files without overwriting user configuration
- [ ] Preserve the existing project name and detect service, volume, port, and project-name conflicts before writing
- [ ] Preview changes and write atomically, with the original file left intact if validation fails
- [ ] Allow multiple compatible databases to be selected together, including Redis with PostgreSQL or MySQL
- [ ] Allocate non-conflicting host ports and display every generated connection URL
- [ ] Add configuration prompts for image version, host port, database name, credentials, persistence, and optional admin UI
- [ ] Prefer Compose project and service names over fixed `container_name` values
- [ ] Add provider health checks and make admin UIs wait for healthy databases
- [ ] Validate every generated or modified file with `docker compose config`
- [ ] Add unit, snapshot, and container-backed integration tests for every provider

### Phase 2: More local databases

- [ ] Add MongoDB using the Docker Official Image, a named volume, authentication, a health check, and a copy-pastable URL
- [ ] Add SQLite file mode without requiring Docker
- [ ] Add local libSQL HTTP mode through `turso dev --db-file`, with clear install and start instructions

### Phase 3: Hosted and HTTP database connections

- [ ] Add a connection-profile flow for existing Turso databases
- [ ] Add a connection-profile flow for existing PlanetScale MySQL and PostgreSQL databases
- [ ] Generate `.env.example` placeholders and framework-neutral setup instructions without saving live tokens or passwords
- [ ] Optionally integrate authenticated provider CLIs for local proxy and development workflows
- [ ] Keep hosted connections separate from Docker Compose generation

### Template quality bar

- Use official database images and documented initialization variables and data paths
- Bind development ports to `127.0.0.1` by default
- Pin supported image release lines instead of using `latest`
- Persist data in named volumes unless the user opts out
- Include provider-native health checks and actionable connection details
- Treat generated credentials as local-development defaults and support safer overrides
