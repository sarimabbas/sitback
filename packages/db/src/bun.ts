import { dbFilePath, ensureConfigDir } from "@sitback/utils";
import { drizzle } from "drizzle-orm/bun-sqlite";

ensureConfigDir();

export const db = drizzle(dbFilePath);
