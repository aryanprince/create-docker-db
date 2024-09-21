export function generateDockerCompose(
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
