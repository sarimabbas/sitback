import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTempConfigDir, removeTempConfigDir, runCli } from "./helpers";

let configDir = "";

beforeEach(() => {
  configDir = createTempConfigDir("sitback-cli-delete-");
});

afterEach(() => {
  removeTempConfigDir(configDir);
});

describe("cli delete", () => {
  test("fails when --ids is missing", () => {
    const result = runCli(["delete"], configDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing required --ids option");
  });

  test("deletes requested todos and unlinks children", () => {
    runCli(["add", "--description", "map", "--status", "in_progress"], configDir);
    runCli(["add", "--description", "reduce", "--status", "todo", "--predecessors", "1"], configDir);
    runCli(["add", "--description", "ready", "--status", "todo"], configDir);

    const beforeDelete = runCli(["get", "--ids", "2"], configDir);
    const beforeTodos = Bun.JSON5.parse(beforeDelete.stdout) as Array<Record<string, unknown>>;
    expect(beforeTodos[0]?.isBlocked).toBe(true);

    const result = runCli(["delete", "--ids", "1,3"], configDir);

    expect(result.exitCode).toBe(0);
    const payload = Bun.JSON5.parse(result.stdout) as Record<string, unknown>;
    expect(payload.deletedCount).toBe(2);

    const afterDelete = runCli(["get", "--ids", "2"], configDir);
    const afterTodos = Bun.JSON5.parse(afterDelete.stdout) as Array<Record<string, unknown>>;
    expect(afterTodos).toHaveLength(1);
    expect(afterTodos[0]?.isBlocked).toBe(false);
  });
});
