import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./helpers";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function stripAnsi(raw: string): string {
  return raw.replace(/\u001b\[[0-9;]*m/g, "");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("cli help defaults", () => {
  test("shows defaults for todo get", () => {
    const configDir = createTempDir("sitback-cli-help-");

    const result = runCli(["todo", "get", "--help"], configDir);
    const output = stripAnsi(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Default: "20"');
  });

  test("shows default for todo add status", () => {
    const configDir = createTempDir("sitback-cli-help-");

    const result = runCli(["todo", "add", "--help"], configDir);
    const output = stripAnsi(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Default: "todo"');
  });

  test("shows default for export format", () => {
    const configDir = createTempDir("sitback-cli-help-");

    const result = runCli(["export", "--help"], configDir);
    const output = stripAnsi(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Default: "json5"');
  });

  test("shows defaults for web command", () => {
    const configDir = createTempDir("sitback-cli-help-");

    const result = runCli(["web", "--help"], configDir);
    const output = stripAnsi(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Default: "127.0.0.1"');
    expect(output).toContain('Default: "3000"');
  });
});
