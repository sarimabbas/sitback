import { mkdirSync } from "node:fs";
import { drizzle } from "drizzle-orm/libsql";
import { configDir, dbFilePath } from "./config";

mkdirSync(configDir, { recursive: true });

export const db = drizzle({ connection: { url: `file:${dbFilePath}` } });
