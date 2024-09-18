import { Command } from 'commander';
import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';

const program = new Command();

program
  .name('dev-db')
  .description('A CLI to easily create DBs for local development using Docker Compose')
  .version('0.0.1')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'dbType',
        message: 'Which database would you like to use?',
        choices: ['PostgreSQL', 'MySQL'],
      },
    ]);

    const dockerComposeContent = generateDockerCompose(answers.dbType);
    
    fs.writeFileSync(path.join(process.cwd(), 'docker-compose.yml'), dockerComposeContent);
    console.log('Docker Compose file created successfully!');
  });

function generateDockerCompose(dbType: string): string {
  if (dbType === 'MySQL') {
    return `
version: "3.9"

name: myprojectname-mysql

services:
  # This is your local MySQL database instance
  mysql-db:
    image: mysql
    restart: always
    environment:
      MYSQL_DATABASE: myprojectname
      MYSQL_ROOT_PASSWORD: root
      MYSQL_USER: dev
      MYSQL_PASSWORD: dev
    volumes:
      - myprojectname-data:/var/lib/mysql
    ports:
      - "6969:3306" # Access the DB at port 6969

  # Use Adminer to quickly view the database at localhost:8069
  adminer:
    image: adminer
    restart: always
    ports:
      - "8089:8080"

volumes:
  myprojectname-data:
    driver: local
`;
  } else {
    return `
version: "3.9"

name: myprojectname-postgres

services:
  # This is your local Postgres database instance
  postgres-db:
    image: postgres
    restart: always
    environment:
      POSTGRES_DB: myprojectname
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    volumes:
      - myprojectname-data:/var/lib/postgresql/data
    ports:
      - "6969:5432" # Access the DB at port 6969

  # Use Adminer to quickly view the database at localhost:8069
  adminer:
    image: adminer
    restart: always
    ports:
      - "8069:8080"

volumes:
  myprojectname-data:
    driver: local
`;
  }
}

program.parse(process.argv);
