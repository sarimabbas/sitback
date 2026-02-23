import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const xdgConfigHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
const defaultConfigDir = join(xdgConfigHome, "sitback");

export const configDir = process.env.SITBACK_CONFIG_DIR ?? defaultConfigDir;
export const dbFilePath = join(configDir, "sitback.db");

export function ensureConfigDir(): void {
  mkdirSync(configDir, { recursive: true });
}
