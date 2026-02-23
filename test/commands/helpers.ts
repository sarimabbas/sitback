import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function createTempConfigDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function removeTempConfigDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export function runCli(args: string[], configDir: string) {
  const bunBin = Bun.which("bun") ?? "bun";

  const processResult = Bun.spawnSync({
    cmd: [bunBin, "run", "src/index.ts", ...args],
    cwd: process.cwd(),
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
