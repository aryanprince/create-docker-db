#!/usr/bin/env node

import * as p from "@clack/prompts";
import { Command } from "commander";
import fs from "fs";
import path from "path";

import packageJson from "../package.json";
import {
  generateDockerCompose,
  type Database,
} from "~/utils/generate-docker-compose-file";
import { getConnectionUrl } from "~/utils/get-connection-url";

const projectNamePattern = /^[a-z0-9][a-z0-9_-]*$/;

function normalizeProjectName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .slice(0, 63);

  return normalized || "dev-db";
}

const program = new Command();

program
  .name("create-docker-db")
  .description(
    "A CLI to easily create DBs for local development using Docker Compose",
  )
  .version(packageJson.version)
  .action(async () => {
    // Get the current directory name to use as the default project name
    const currentDir = normalizeProjectName(path.basename(process.cwd()));

    console.log("\n");
    p.intro(`create-docker-db`);

    // Prompts user to select database and project name
    const answers = await p.group(
      {
        selectedDatabase: () => {
          return p.select<{ value: Database; label: string }[], Database>({
            message: "What database would you like to use?",
            options: [
              { value: "postgres", label: "PostgreSQL" },
              { value: "mysql", label: "MySQL" },
              {
                value: "redis",
                label: "Redis",
              },
            ],
            initialValue: "postgres",
          });
        },
        selectedProjectName: () =>
          p.text({
            message: "Enter your project name",
            placeholder: currentDir,
            defaultValue: currentDir,
            validate: (value) => {
              const projectName = value || currentDir;

              if (!projectNamePattern.test(projectName)) {
                return "Use lowercase letters, numbers, hyphens, or underscores, starting with a letter or number.";
              }

              if (projectName.length > 63) {
                return "Project names must be 63 characters or fewer.";
              }
            },
          }),
      },
      {
        // On Cancel callback that wraps the group
        // So if the user cancels one of the prompts in the group this function will be called
        onCancel: ({ results }) => {
          p.cancel("Operation cancelled.");
          process.exit(0);
        },
      },
    );

    // Generate Docker Compose file content
    const dockerComposeContent = generateDockerCompose(
      answers.selectedDatabase,
      answers.selectedProjectName,
    );

    const composePath = path.join(process.cwd(), "docker-compose.yml");

    if (fs.existsSync(composePath)) {
      const shouldOverwrite = await p.confirm({
        message: "docker-compose.yml already exists. Overwrite it?",
        initialValue: false,
      });

      if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
        p.cancel("Existing docker-compose.yml was left unchanged.");
        return;
      }
    }

    // Create docker-compose.yml file with the generated content
    fs.writeFileSync(composePath, dockerComposeContent, "utf8");

    // Generate database connection URL
    const connectionUrl = getConnectionUrl(
      answers.selectedDatabase,
      answers.selectedProjectName,
    );

    p.outro(
      `✔ docker-compose.yml file created successfully!
      \nNext steps:
      \n1. 🐳 Run your database with Docker Compose:
      docker compose up -d
      \n2. 📋 Copy this connection URL to start using your database:
      ${connectionUrl}
      `,
    );
  });

program.parse(process.argv);
