import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { dbDir, dbFilePath, ensureConfigDir } from "@/config";
import { applySqlitePragmas } from "./pragmas";

ensureConfigDir();

export const db = drizzle({ connection: { url: `file:${dbFilePath}` } });
const migrationsFolder = join(import.meta.dir, "..", "..", "drizzle");

export async function initializeSqlitePragmas(): Promise<void> {
  await applySqlitePragmas(db);
}

export async function initializeDatabase(): Promise<void> {
  await initializeSqlitePragmas();

  try {
    await migrate(db, { migrationsFolder });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const tableExistsConflict = /table\s+`?\w+`?\s+already exists/i.test(message);

    if (!tableExistsConflict) {
      throw error;
    }

    throw new Error([
      "Detected a legacy/partially-managed SQLite database that conflicts with Drizzle migrations.",
      `Database path: ${dbFilePath}`,
      `Database directory: ${dbDir}`,
      "Reason: migration history does not match the existing tables, so Drizzle tried to re-run early CREATE TABLE statements.",
      "",
      "Recommended recovery:",
      `1) mv \"${dbDir}\" \"${dbDir}.legacy-$(date +%Y%m%d%H%M%S)\"`,
      "2) Re-run the CLI; it will create a fresh DB directory and apply all migrations",
      "",
      "If you must keep existing data, migrate it manually into the new schema first."
    ].join("\n"));
  }
}

export * from "./schema";
export * from "./queries";
export * from "./pragmas";
