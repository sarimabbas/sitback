import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const drizzleDir = join(projectRoot, "drizzle");
const drizzleMetaDir = join(drizzleDir, "meta");
const customMigrationsPath = join(projectRoot, "src", "custom-migrations.sql");

function run(command: string[]) {
  const result = Bun.spawnSync({
    cmd: command,
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "inherit",
    env: Bun.env
  });

  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}`);
  }
}

function removeFilesInDirectory(dirPath: string) {
  if (!existsSync(dirPath)) {
    return;
  }

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    rmSync(join(dirPath, entry.name), { force: true });
  }
}

function resetDrizzleJournal() {
  mkdirSync(drizzleMetaDir, { recursive: true });
  writeFileSync(
    join(drizzleMetaDir, "_journal.json"),
    JSON.stringify(
      {
        version: "7",
        dialect: "sqlite",
        entries: []
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

function getLatestMigrationPath(): string {
  const sqlFiles = readdirSync(drizzleDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const latestFile = sqlFiles.at(-1);
  if (!latestFile) {
    throw new Error("No migration SQL file was generated");
  }

  return join(drizzleDir, latestFile);
}

function appendCustomMigrationSql(targetMigrationPath: string) {
  const migrationSql = readFileSync(targetMigrationPath, "utf8");
  const customSql = readFileSync(customMigrationsPath, "utf8").trim();

  const nextSql = [migrationSql.trimEnd(), "--> statement-breakpoint", customSql, ""].join("\n");
  writeFileSync(targetMigrationPath, nextSql, "utf8");
}

removeFilesInDirectory(drizzleDir);
removeFilesInDirectory(drizzleMetaDir);
resetDrizzleJournal();

run(["bunx", "drizzle-kit", "generate"]);

const latestMigrationPath = getLatestMigrationPath();
appendCustomMigrationSql(latestMigrationPath);

run(["bunx", "drizzle-kit", "migrate"]);

console.log(`Squashed migrations and appended custom SQL to ${latestMigrationPath}`);
