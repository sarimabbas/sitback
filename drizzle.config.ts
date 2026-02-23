import { defineConfig } from "drizzle-kit";
import { dbFilePath, ensureConfigDir } from "./src/config";

ensureConfigDir();

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: dbFilePath
  }
});
