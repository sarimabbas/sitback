import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./helpers";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("cli init", () => {
  test("requires init before todo commands", () => {
    const configDir = mkdtempSync(join(tmpdir(), "sitback-cli-init-"));
    tempDirs.push(configDir);

    const beforeInit = runCli(["todo", "add", "--description", "x", "--status", "todo"], configDir);

    expect(beforeInit.exitCode).toBe(1);
    expect(beforeInit.stderr).toContain("Database is not initialized. Run 'sb init'.");

    const initResult = runCli(["init"], configDir);
    expect(initResult.exitCode).toBe(0);
    expect(initResult.stdout).toContain("Database initialized.");

    const afterInit = runCli(["todo", "add", "--description", "x", "--status", "todo"], configDir);
    expect(afterInit.exitCode).toBe(0);
  });
});
