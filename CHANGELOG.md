

* 👷 Fix indentation in workflow file (2abb2cb)
* 👷 Fix typo in workflow file (122ebab)
* 👷 Initialize NPM config before creating release (9186af2)
* 🙈 Create `.npmignore` (ff65db0)
* ➕ Install `release-it-pnpm` (45ec962)
* 🙈 Create `.prettierignore` (0e1068a)
* 🎨 Fix Prettier formatting errors (d47a44f)
* ✨ Setup and configure `release-it` (3b2309d)

# create-docker-db

## 0.3.1

### Patch Changes

- 9be78a5: ✨ Add Redis and switch to using templates
  ✨ Add `redis` as a new database provider option
  ♻️ Add templates for generating Docker Compose files
  📝 Minor change in README

## 0.3.0

### Minor Changes

- 8b31b3b: ✨ New UI
  ✨ Switch to `clack` from `inquirer` for CLI prompts
  ♻️ Refactor code
  🎨 Add more database provider options

## 0.2.2

### Patch Changes

- d765188: ✨ Migrate to `tsup` from `tsc`
  👷 Add auto-publish CI workflow
  ➖ Remove `attw`
  🔨 Add clean script, reorganize scripts

## 0.2.1

### Patch Changes

- f68bcdd: Remove CLI screenshot asset from package

## 0.2.0

### Minor Changes

- Improve CLI by adding post-run instructions.

  ### Features

  ✨ Implement more informative CLI log messages and include steps to follow for better user experience
  ♻️ Upgrade to latest version of `inquirer` for improved performance
  💄 Enhance CLI output with emojis for better user experience
  📝 Reorganize README for better project overview

## 0.1.0

### Minor Changes

- d6caab2: Add project name customization to CLI

  ### Features

  - [x] Add support for custom Docker Compose project names, defaulting to the current directory name
  - [x] Display copy-pastable connection URLs for the created databases

## 0.0.1

### Patch Changes

- 15a9afa: Initial release with support for scaffolding a local Docker database setup for MySQL or Postgres.
