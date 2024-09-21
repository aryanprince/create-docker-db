import fs from "fs";
import path from "path";

export function generateDockerCompose(
  selectedDatabase: string,
  selectedProjectName: string,
): string {
  const templatePath = path.join(
    __dirname,
    "..",
    "templates",
    `${selectedDatabase}.docker-compose.yml`,
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template for ${selectedDatabase} not found`);
  }

  // Read the template file
  let templateContent = fs.readFileSync(templatePath, "utf-8");

  // Replace placeholders (like ${selectedProjectName}) in the template
  templateContent = templateContent.replace(
    /\$\{selectedProjectName\}/g,
    selectedProjectName,
  );

  return templateContent;
}
