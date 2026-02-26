import { defineConfig } from "drizzle-kit";
import { dbFilePath, ensureConfigDir } from "@sitback/utils";

ensureConfigDir();

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: dbFilePath
  }
});
