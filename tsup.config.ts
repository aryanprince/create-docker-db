import { defineConfig } from "tsup";

export default defineConfig({
  entryPoints: ["src/index.ts"],
  format: ["cjs"],
  outDir: "dist",
  clean: true,
});
