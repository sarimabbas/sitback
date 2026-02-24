import { join } from "node:path";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { dbDir, dbFilePath, ensureConfigDir } from "@/config";
import { applySqlitePragmas } from "./pragmas";

ensureConfigDir();

export const db = drizzle({ connection: { url: `file:${dbFilePath}` } });
const migrationsFolder = join(import.meta.dir, "..", "..", "drizzle");
const migrationsJournalFile = join(migrationsFolder, "meta", "_journal.json");

function getExpectedMigrationCount(): number {
  try {
    const raw = readFileSync(migrationsJournalFile, "utf8");
    const parsed = JSON.parse(raw) as { entries?: unknown[] };
    return parsed.entries?.length ?? 0;
  } catch {
    return 0;
  }
}

export async function initializeSqlitePragmas(): Promise<void> {
  await applySqlitePragmas(db);
}

export async function initializeDatabase(): Promise<void> {
  await initializeSqlitePragmas();
}

export async function runMigrations(): Promise<void> {
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
      "2) Run 'sb init' to apply all migrations to a fresh DB",
      "",
      "If you must keep existing data, migrate it manually into the new schema first."
    ].join("\n"));
  }
}

export async function assertDatabaseInitialized(): Promise<void> {
  const expectedMigrationCount = getExpectedMigrationCount();

  try {
    const result = await db.$client.execute("SELECT count(*) AS count FROM __drizzle_migrations;");
    const rows = result.rows as Array<Array<number | null> | { count?: number | null }>;
    const first = rows[0];
    const appliedMigrationCount =
      Array.isArray(first) ? Number(first[0] ?? 0) : Number(first?.count ?? 0);

    if (appliedMigrationCount < expectedMigrationCount) {
      throw new Error(
        `Database schema is out of date (applied ${appliedMigrationCount}/${expectedMigrationCount} migrations). Run 'sb init'.`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table/i.test(message) || /Database schema is out of date/i.test(message)) {
      throw new Error("Database is not initialized. Run 'sb init'.");
    }
    throw error;
  }
}

export async function getDatabaseInitializationWarning(): Promise<string | null> {
  const expectedMigrationCount = getExpectedMigrationCount();

  try {
    const result = await db.$client.execute("SELECT count(*) AS count FROM __drizzle_migrations;");
    const rows = result.rows as Array<Array<number | null> | { count?: number | null }>;
    const first = rows[0];
    const appliedMigrationCount =
      Array.isArray(first) ? Number(first[0] ?? 0) : Number(first?.count ?? 0);

    if (appliedMigrationCount >= expectedMigrationCount) {
      return null;
    }

    return "database is not initialized. run 'sb init'.";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table/i.test(message)) {
      return "database is not initialized. run 'sb init'.";
    }
    return null;
  }
}

export * from "./schema";
export * from "./queries";
export * from "./pragmas";
