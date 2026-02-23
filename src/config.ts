import { homedir } from "node:os";
import { join } from "node:path";

const xdgConfigHome = Bun.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
const defaultConfigDir = join(xdgConfigHome, "sitback");

export const configDir = Bun.env.SITBACK_CONFIG_DIR ?? defaultConfigDir;
export const dbFilePath = join(configDir, "sitback.db");
