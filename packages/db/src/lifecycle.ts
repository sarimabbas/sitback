import { dbDir, dbFilePath, ensureConfigDir } from "@sitback/utils";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applySqlitePragmas } from "./pragmas";

const moduleDir = dirname(fileURLToPath(import.meta.url));

type SqliteStatement = {
  run: () => unknown;
  get: () => unknown;
};

type SqliteClient = {
  query?: (statement: string) => SqliteStatement;
  prepare?: (statement: string) => SqliteStatement;
};

type SqliteDbWithClient = {
  $client: SqliteClient;
};

function resolveMigrationsFolder(): string {
  const bundled = join(moduleDir, "..", "drizzle");
  if (existsSync(join(bundled, "meta", "_journal.json"))) {
    return bundled;
  }

  const workspacePath = join(process.cwd(), "packages", "db", "drizzle");
  if (existsSync(join(workspacePath, "meta", "_journal.json"))) {
    return workspacePath;
  }

  const packagePath = join(process.cwd(), "drizzle");
  if (existsSync(join(packagePath, "meta", "_journal.json"))) {
    return packagePath;
  }

  return bundled;
}

function getMigrationFiles(migrationsFolder: string): string[] {
  return readdirSync(migrationsFolder)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

function execute(db: SqliteDbWithClient, statement: string): void {
  if (db.$client.query) {
    db.$client.query(statement).run();
    return;
  }

  if (db.$client.prepare) {
    db.$client.prepare(statement).run();
    return;
  }

  throw new Error("Unsupported SQLite client: expected query() or prepare() method");
}

function getRow(db: SqliteDbWithClient, statement: string): unknown {
  if (db.$client.query) {
    return db.$client.query(statement).get();
  }

  if (db.$client.prepare) {
    return db.$client.prepare(statement).get();
  }

  throw new Error("Unsupported SQLite client: expected query() or prepare() method");
}

function ensureMigrationsTable(db: SqliteDbWithClient): void {
  execute(
    db,
    `CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric);`,
  );
}

function getAppliedMigrationCount(db: SqliteDbWithClient): number {
  const row = getRow(db, "SELECT count(*) AS count FROM __drizzle_migrations;") as
    | { count?: number | bigint | null }
    | undefined;
  return Number(row?.count ?? 0);
}

function getExpectedMigrationCount(migrationsFolder: string): number {
  try {
    return getMigrationFiles(migrationsFolder).length;
  } catch {
    return 0;
  }
}

export async function initializeSqlitePragmas(db: SqliteDbWithClient): Promise<void> {
  await applySqlitePragmas(db);
}

export async function initializeDatabase(db: SqliteDbWithClient): Promise<void> {
  ensureConfigDir();
  await initializeSqlitePragmas(db);
}

export async function runMigrations(db: SqliteDbWithClient): Promise<void> {
  ensureConfigDir();

  const migrationsFolder = resolveMigrationsFolder();
  const migrationFiles = getMigrationFiles(migrationsFolder);

  try {
    ensureMigrationsTable(db);
    const appliedCount = getAppliedMigrationCount(db);
    const pendingFiles = migrationFiles.slice(appliedCount);

    for (const fileName of pendingFiles) {
      const migrationSql = readFileSync(join(migrationsFolder, fileName), "utf8");
      const statements = migrationSql
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0);

      for (const statement of statements) {
        execute(db, statement);
      }

      const escapedFileName = fileName.replace(/'/g, "''");
      execute(
        db,
        `INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('${escapedFileName}', ${Date.now()});`,
      );
    }
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
      "If you must keep existing data, migrate it manually into the new schema first.",
    ].join("\n"));
  }
}

export async function assertDatabaseInitialized(
  db: SqliteDbWithClient,
): Promise<void> {
  const expectedMigrationCount = getExpectedMigrationCount(resolveMigrationsFolder());

  try {
    const appliedMigrationCount = getAppliedMigrationCount(db);

    if (appliedMigrationCount < expectedMigrationCount) {
      throw new Error(
        `Database schema is out of date (applied ${appliedMigrationCount}/${expectedMigrationCount} migrations). Run 'sb init'.`,
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

export async function getDatabaseInitializationWarning(
  db: SqliteDbWithClient,
): Promise<string | null> {
  const expectedMigrationCount = getExpectedMigrationCount(resolveMigrationsFolder());

  try {
    const appliedMigrationCount = getAppliedMigrationCount(db);

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
