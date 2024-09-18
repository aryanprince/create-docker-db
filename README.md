# 📦 create-docker-db

## 📝 Description

A CLI to easily create DBs for local development using Docker Compose. Currently supports MySQL and Postgres.

## 🚀 Usage

```bash
npx create-docker-db # or bunx create-docker-db
```

## 🎯 Roadmap

### Features

- [x] Setup Changesets
- [ ] Display copy-pastable connection URLs for the created databases
- [ ] Modify existing Docker Compose files instead of overwriting them
- [ ] Add support for more databases (see below)
- [ ] Add support for more configurations (like custom container names based on project name)

### Support Additional Databases

- [ ] Add support for MongoDB
- [ ] Add support for Redis
- [ ] Add support for SQLite (with LibSQL HTTP for Turso)
- [ ] Add support for HTTP based DB services (like PlanetScale, Turso, etc.)
