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
  test("returns todos by default", () => {
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
    expect(todos).toHaveLength(3);
    const descriptions = todos.map((todo) => String(todo.description));
    expect(descriptions).toContain("map");
    expect(descriptions).toContain("reduce");
    expect(descriptions).toContain("ready");
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

  test("does not warn about --num when only default is applied", () => {
    runCli(["todo", "add", "--description", "first", "--status", "todo"], configDir);
    runCli(["todo", "add", "--description", "second", "--status", "todo"], configDir);

    const result = runCli(["todo", "get", "--ids", "2,1"], configDir);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("Warning: --num is ignored when --ids is provided");
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
    expect(highPriorityTodos).toHaveLength(1);
    expect(highPriorityTodos[0]?.description).toBe("blocked");
  });

  test("filters todos by tag path and includes descendant tags", () => {
    runCli(["tag", "add", "--path", "work/backend/api"], configDir);
    runCli(["todo", "add", "--description", "backend task", "--tag", "work/backend", "--status", "todo"], configDir);
    runCli(["todo", "add", "--description", "api task", "--tag", "work/backend/api", "--status", "todo"], configDir);
    runCli(["todo", "add", "--description", "other task", "--tag", "work", "--status", "todo"], configDir);

    const result = runCli(["todo", "get", "--tag", "work/backend", "--num", "10"], configDir);

    expect(result.exitCode).toBe(0);
    const todos = Bun.JSON5.parse(result.stdout) as Array<Record<string, unknown>>;
    const descriptions = todos.map((todo) => String(todo.description));
    expect(descriptions).toContain("backend task");
    expect(descriptions).toContain("api task");
    expect(descriptions).not.toContain("other task");
  });

  test("rejects using --tag and --tag-id together", () => {
    const result = runCli(["todo", "get", "--tag", "work/backend", "--tag-id", "2"], configDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Use either --tag or --tag-id, not both");
  });

  test("rejects non-integer --num via Cliffy type validation", () => {
    const result = runCli(["todo", "get", "--num", "abc"], configDir);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Option "--num" must be of type "integer", but got "abc"');
  });

  test("rejects invalid --due-before via custom type", () => {
    const result = runCli(["todo", "get", "--due-before", "2030/01/01"], configDir);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Option "--due-before" must use YYYY-MM-DD, but got "2030/01/01"');
  });
});
