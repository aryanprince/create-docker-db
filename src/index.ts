import { input, select, Separator } from "@inquirer/prompts";
import { Command } from "commander";
import fs from "fs";
import path from "path";

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

    // Prompts user to select database and project name
    const answers = {
      selectedDatabase: await select({
        message: "Which database would you like to use?",
        choices: [
          {
            value: "postgres",
            name: "PostgreSQL",
            description:
              "PostgreSQL is a powerful, open-source object-relational database system",
          },
          {
            value: "mysql",
            name: "MySQL",
            description:
              "MySQL is an open-source relational database management system",
          },
          // Separator to visually separate the coming soon databases from the available ones
          new Separator(),
          {
            value: "redis",
            name: "Redis",
            disabled: "(Coming soon!)",
          },
          {
            value: "mongodb",
            name: "MongoDB",
            disabled: "(Coming soon!)",
          },
        ],
      }),
      selectedProjectName: await input({
        message: "Enter your project name:",
        default: currentDir,
      }),
    };

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

    console.log(
      "✅ Docker Compose file created successfully! (`docker-compose.yml`)",
    );

    // Generate database connection URL
    const connectionUrl = getConnectionUrl(
      answers.selectedDatabase,
      answers.selectedProjectName,
    );

    console.log("\nNext steps:");
    console.log("\n1. 🐳 Run your database with Docker Compose:");
    console.log("docker-compose up -d");

    console.log(
      "\n2. 📋 Copy this connection URL to start using your database:",
    );
    console.log(connectionUrl);
  });

function generateDockerCompose(
  selectedDatabase: string,
  selectedProjectName: string,
): string {
  switch (selectedDatabase) {
    case "postgres":
      return `
  version: "3.9"
  
  name: ${selectedProjectName}-postgres
  
  services:
    # This is your local Postgres database instance
    postgres-db:
      image: postgres
      restart: always
      environment:
        POSTGRES_DB: ${selectedProjectName}
        POSTGRES_USER: dev
        POSTGRES_PASSWORD: dev
      volumes:
        - ${selectedProjectName}-data:/var/lib/postgresql/data
      ports:
        - "6969:5432" # Access the DB at port 6969
  
    # Use Adminer to quickly view the database at localhost:8069
    adminer:
      image: adminer
      restart: always
      ports:
        - "8069:8080"
  
  volumes:
    ${selectedProjectName}-data:
      driver: local
  `;
    case "mysql":
      return `
    version: "3.9"
    
    name: ${selectedProjectName}-mysql
    
    services:
      # This is your local MySQL database instance
      mysql-db:
        image: mysql
        restart: always
        environment:
          MYSQL_DATABASE: ${selectedProjectName}
          MYSQL_ROOT_PASSWORD: root
          MYSQL_USER: dev
          MYSQL_PASSWORD: dev
        volumes:
          - ${selectedProjectName}-data:/var/lib/mysql
        ports:
          - "6969:3306" # Access the DB at port 6969
    
      # Use Adminer to quickly view the database at localhost:8089
      adminer:
        image: adminer
        restart: always
        ports:
          - "8089:8080"
    
    volumes:
      ${selectedProjectName}-data:
        driver: local
    `;
    default:
      throw new Error("Database not supported");
  }
}

function getConnectionUrl(
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

program.parse(process.argv);
