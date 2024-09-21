import * as p from "@clack/prompts";
import { Command } from "commander";
import fs from "fs";
import path from "path";

import { generateDockerCompose } from "~/utils/generate-docker-compose-file";
import { getConnectionUrl } from "~/utils/get-connection-url";

const program = new Command();

program
  .name("dev-db")
  .description(
    "A CLI to easily create DBs for local development using Docker Compose",
  )
  .version("0.0.2")
  .action(async () => {
    // Get the current directory name to use as the default project name
    const currentDir = path.basename(process.cwd());

    console.log("\n");
    p.intro(`create-docker-db`);

    // Prompts user to select database and project name
    const answers = await p.group(
      {
        selectedDatabase: () => {
          return p.select({
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

    // Create docker-compose.yml file with the generated content
    fs.writeFileSync(
      path.join(process.cwd(), "docker-compose.yml"),
      dockerComposeContent,
    );

    // Generate database connection URL
    const connectionUrl = getConnectionUrl(
      answers.selectedDatabase,
      answers.selectedProjectName,
    );

    p.outro(
      `✔ docker-compose.yml file created successfully!
      \nNext steps:
      \n1. 🐳 Run your database with Docker Compose:
      docker-compose up -d
      \n2. 📋 Copy this connection URL to start using your database:
      ${connectionUrl}
      `,
    );
  });

program.parse(process.argv);
