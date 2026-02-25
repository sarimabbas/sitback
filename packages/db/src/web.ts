import { dbFilePath, ensureConfigDir } from "@sitback/utils";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

ensureConfigDir();

export const db = drizzle({ client: new Database(dbFilePath) });
