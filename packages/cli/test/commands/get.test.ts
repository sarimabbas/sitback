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

  test("filters by status and in-progress shortcut", () => {
    runCli(["todo", "add", "--description", "queued", "--status", "todo"], configDir);
    runCli(["todo", "add", "--description", "running", "--status", "in_progress"], configDir);
    runCli(["todo", "add", "--description", "done", "--status", "completed"], configDir);

    const explicit = runCli(["todo", "get", "--status", "completed"], configDir);
    expect(explicit.exitCode).toBe(0);
    const explicitRows = Bun.JSON5.parse(explicit.stdout) as Array<Record<string, unknown>>;
    expect(explicitRows).toHaveLength(1);
    expect(explicitRows[0]?.description).toBe("done");

    const shortcut = runCli(["todo", "get", "--in-progress"], configDir);
    expect(shortcut.exitCode).toBe(0);
    const shortcutRows = Bun.JSON5.parse(shortcut.stdout) as Array<Record<string, unknown>>;
    expect(shortcutRows).toHaveLength(1);
    expect(shortcutRows[0]?.description).toBe("running");
  });

  test("filters by assignee and lease status", () => {
    runCli(["todo", "add", "--description", "owned", "--status", "in_progress"], configDir);
    runCli(["todo", "add", "--description", "free", "--status", "todo"], configDir);

    runCli(
      [
        "todo",
        "update",
        "--id",
        "1",
        "--assignee",
        "worker-1",
        "--assignee-lease",
        "2000-01-01 00:00:00"
      ],
      configDir
    );

    const byAssignee = runCli(["todo", "get", "--assignee", "worker-1"], configDir);
    expect(byAssignee.exitCode).toBe(0);
    const byAssigneeRows = Bun.JSON5.parse(byAssignee.stdout) as Array<Record<string, unknown>>;
    expect(byAssigneeRows).toHaveLength(1);
    expect(byAssigneeRows[0]?.description).toBe("owned");

    const leaseExpired = runCli(["todo", "get", "--lease-expired", "true"], configDir);
    expect(leaseExpired.exitCode).toBe(0);
    const leaseRows = Bun.JSON5.parse(leaseExpired.stdout) as Array<Record<string, unknown>>;
    expect(leaseRows.map((row) => row.description)).toContain("owned");

    const unassigned = runCli(["todo", "get", "--has-assignee", "false"], configDir);
    expect(unassigned.exitCode).toBe(0);
    const unassignedRows = Bun.JSON5.parse(unassigned.stdout) as Array<Record<string, unknown>>;
    expect(unassignedRows).toHaveLength(1);
    expect(unassignedRows[0]?.description).toBe("free");
  });

  test("supports fields projection, sorting, and count output", () => {
    runCli(["todo", "add", "--description", "a", "--status", "todo", "--priority", "1"], configDir);
    runCli(["todo", "add", "--description", "b", "--status", "todo", "--priority", "5"], configDir);

    const projected = runCli(["todo", "get", "--fields", "id,description", "--sort-by", "id", "--order", "desc"], configDir);
    expect(projected.exitCode).toBe(0);
    const projectedRows = Bun.JSON5.parse(projected.stdout) as Array<Record<string, unknown>>;
    expect(projectedRows[0]).toEqual({ id: 2, description: "b" });
    expect(projectedRows[1]).toEqual({ id: 1, description: "a" });

    const count = runCli(["todo", "get", "--count", "--status", "todo"], configDir);
    expect(count.exitCode).toBe(0);
    const countPayload = Bun.JSON5.parse(count.stdout) as Record<string, unknown>;
    expect(countPayload.count).toBe(2);
  });

  test("supports json and markdown output formats", () => {
    runCli(["todo", "add", "--description", "md-item", "--status", "todo"], configDir);

    const json = runCli(["todo", "get", "--format", "json"], configDir);
    expect(json.exitCode).toBe(0);
    expect(() => JSON.parse(json.stdout)).not.toThrow();

    const markdown = runCli(["todo", "get", "--format", "markdown", "--fields", "id,description"], configDir);
    expect(markdown.exitCode).toBe(0);
    expect(markdown.stdout).toContain("id=1");
    expect(markdown.stdout).toContain("description=md-item");
  });
});
