import { drizzle } from "drizzle-orm/libsql";
import { dbFilePath, ensureConfigDir } from "@/config";
import { applySqlitePragmas } from "./pragmas";

ensureConfigDir();

export const db = drizzle({ connection: { url: `file:${dbFilePath}` } });

export async function initializeSqlitePragmas(): Promise<void> {
  await applySqlitePragmas(db);
}

export * from "./schema";
export * from "./queries";
export * from "./pragmas";
