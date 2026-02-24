import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cliPackageRoot = join(import.meta.dir, "..", "..");

export function createTempConfigDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(dir, { recursive: true });

  const bunBin = Bun.which("bun") ?? "bun";
  const initResult = Bun.spawnSync({
    cmd: [bunBin, "run", "src/index.ts", "init"],
    cwd: cliPackageRoot,
    env: {
      ...Bun.env,
      SITBACK_CONFIG_DIR: dir
    },
    stdout: "pipe",
    stderr: "pipe"
  });

  if (initResult.exitCode !== 0) {
    const stderr = Buffer.from(initResult.stderr).toString("utf8").trim();
    throw new Error(`Failed to initialize test database: ${stderr}`);
  }

  return dir;
}

export function removeTempConfigDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export function runCli(args: string[], configDir: string) {
  const bunBin = Bun.which("bun") ?? "bun";

  const processResult = Bun.spawnSync({
    cmd: [bunBin, "run", "src/index.ts", ...args],
    cwd: cliPackageRoot,
    env: {
      ...Bun.env,
      SITBACK_CONFIG_DIR: configDir
    },
    stdout: "pipe",
    stderr: "pipe"
  });

  return {
    exitCode: processResult.exitCode,
    stdout: Buffer.from(processResult.stdout).toString("utf8").trim(),
    stderr: Buffer.from(processResult.stderr).toString("utf8").trim()
  };
}
