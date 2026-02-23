import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTempConfigDir, removeTempConfigDir, runCli } from "./helpers";

let configDir = "";

beforeEach(() => {
  configDir = createTempConfigDir("sitback-cli-get-");
});

afterEach(() => {
  removeTempConfigDir(configDir);
});

describe("cli get", () => {
  test("returns best next actionable todo by default", () => {
    runCli(["todo", "add", "--description", "map", "--status", "in_progress"], configDir);
    runCli(["todo", "add", "--description", "reduce", "--status", "todo", "--predecessors", "1"], configDir);
    runCli(
      [
        "todo",
        "add",
        "--description",
        "ready",
        "--status",
        "todo",
        "--priority",
        "5",
        "--due-date",
        "2030-01-01"
      ],
      configDir
    );

    const result = runCli(["todo", "get"], configDir);

    expect(result.exitCode).toBe(0);
    const todos = Bun.JSON5.parse(result.stdout) as Array<Record<string, unknown>>;
    expect(todos).toHaveLength(1);
    expect(todos[0]?.description).toBe("ready");
    expect(todos[0]?.isBlocked).toBe(false);
  });

  test("returns ids and warns when combined with --num", () => {
    runCli(["todo", "add", "--description", "first", "--status", "todo"], configDir);
    runCli(["todo", "add", "--description", "second", "--status", "todo"], configDir);

    const result = runCli(["todo", "get", "--ids", "2,1", "--num", "1"], configDir);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Warning: --num is ignored when --ids is provided");
    const todos = Bun.JSON5.parse(result.stdout) as Array<Record<string, unknown>>;
    expect(todos).toHaveLength(2);
    expect(todos[0]?.id).toBe(2);
    expect(todos[1]?.id).toBe(1);
  });

  test("applies blocked and min-priority filters", () => {
    runCli(["todo", "add", "--description", "blocker", "--status", "in_progress"], configDir);
    runCli(
      [
        "todo",
        "add",
        "--description",
        "blocked",
        "--status",
        "todo",
        "--predecessors",
        "1",
        "--priority",
        "5",
        "--due-date",
        "2030-01-01"
      ],
      configDir
    );
    runCli(
      [
        "todo",
        "add",
        "--description",
        "ready-low",
        "--status",
        "todo",
        "--priority",
        "2",
        "--due-date",
        "2030-01-01"
      ],
      configDir
    );

    const blockedOnly = runCli(["todo", "get", "--blocked", "true"], configDir);
    const highPriority = runCli(["todo", "get", "--min-priority", "4", "--num", "5"], configDir);

    expect(blockedOnly.exitCode).toBe(0);
    const blockedTodos = Bun.JSON5.parse(blockedOnly.stdout) as Array<Record<string, unknown>>;
    expect(blockedTodos).toHaveLength(1);
    expect(blockedTodos[0]?.description).toBe("blocked");

    expect(highPriority.exitCode).toBe(0);
    const highPriorityTodos = Bun.JSON5.parse(highPriority.stdout) as Array<Record<string, unknown>>;
    expect(highPriorityTodos).toHaveLength(0);
  });
});
