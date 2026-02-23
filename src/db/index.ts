import { drizzle } from "drizzle-orm/libsql";
import { dbFilePath, ensureConfigDir } from "@/config";

ensureConfigDir();

export const db = drizzle({ connection: { url: `file:${dbFilePath}` } });

export * from "./schema";
export * from "./queries";
