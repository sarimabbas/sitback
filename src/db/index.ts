import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { dbFilePath, ensureConfigDir } from "@/config";
import { applySqlitePragmas } from "./pragmas";

ensureConfigDir();

export const db = drizzle({ connection: { url: `file:${dbFilePath}` } });
const migrationsFolder = join(import.meta.dir, "..", "..", "drizzle");

export async function initializeSqlitePragmas(): Promise<void> {
  await applySqlitePragmas(db);
}

export async function initializeDatabase(): Promise<void> {
  await initializeSqlitePragmas();
  await migrate(db, { migrationsFolder });
}

export * from "./schema";
export * from "./queries";
export * from "./pragmas";
