import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTempConfigDir, removeTempConfigDir, runCli } from "./helpers";

let configDir = "";

beforeEach(() => {
  configDir = createTempConfigDir("sitback-cli-update-");
});

afterEach(() => {
  removeTempConfigDir(configDir);
});

describe("cli todo update", () => {
  test("fails when no update fields are provided", () => {
    runCli(["todo", "add", "--description", "task", "--status", "todo"], configDir);

    const result = runCli(["todo", "update", "--id", "1"], configDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No updates provided");
  });

  test("updates status and replaces predecessors", () => {
    runCli(["todo", "add", "--description", "a", "--status", "completed"], configDir);
    runCli(["todo", "add", "--description", "b", "--status", "in_progress"], configDir);
    runCli(["todo", "add", "--description", "c", "--status", "todo", "--predecessors", "1"], configDir);

    const updateResult = runCli(
      ["todo", "update", "--id", "3", "--status", "todo", "--predecessors", "1,2"],
      configDir
    );
    expect(updateResult.exitCode).toBe(0);

    const fetched = runCli(["todo", "get", "--ids", "3"], configDir);
    const rows = Bun.JSON5.parse(fetched.stdout) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.isBlocked).toBe(true);
  });

  test("updates tag by path and by tag id", () => {
    runCli(["tag", "add", "--path", "work/backend"], configDir);
    runCli(["todo", "add", "--description", "taggable", "--status", "todo"], configDir);

    const byPath = runCli(
      ["todo", "update", "--id", "1", "--tag", "work/backend", "--work-notes", "tag set"],
      configDir
    );
    expect(byPath.exitCode).toBe(0);
    const todoByPath = Bun.JSON5.parse(byPath.stdout) as Record<string, unknown>;
    expect(todoByPath.tagId).toBe(2);

    runCli(["tag", "add", "--path", "work/services"], configDir);
    const byId = runCli(["todo", "update", "--id", "1", "--tag-id", "3"], configDir);
    expect(byId.exitCode).toBe(0);
    const todoById = Bun.JSON5.parse(byId.stdout) as Record<string, unknown>;
    expect(todoById.tagId).toBe(3);
  });

  test("updates assignee and assignee lease", () => {
    runCli(["todo", "add", "--description", "assignable", "--status", "todo"], configDir);

    const result = runCli(
      [
        "todo",
        "update",
        "--id",
        "1",
        "--assignee",
        "worker-7",
        "--assignee-lease",
        "2031-04-15 09:30:00"
      ],
      configDir
    );

    expect(result.exitCode).toBe(0);
    const todo = Bun.JSON5.parse(result.stdout) as Record<string, unknown>;
    expect(todo.assignee).toBe("worker-7");
    expect(todo.assigneeLease).toBe("2031-04-15 09:30:00");
  });

  test("clears assignee and lease, taking precedence over set options", () => {
    runCli(
      [
        "todo",
        "add",
        "--description",
        "assignable",
        "--status",
        "in_progress",
        "--work-notes",
        "has owner"
      ],
      configDir
    );

    runCli(
      [
        "todo",
        "update",
        "--id",
        "1",
        "--assignee",
        "worker-9",
        "--assignee-lease",
        "2031-04-15 09:30:00"
      ],
      configDir
    );

    const clearResult = runCli(
      [
        "todo",
        "update",
        "--id",
        "1",
        "--assignee",
        "worker-10",
        "--clear-assignee",
        "--assignee-lease",
        "2032-01-01 00:00:00",
        "--clear-assignee-lease"
      ],
      configDir
    );

    expect(clearResult.exitCode).toBe(0);
    const todo = Bun.JSON5.parse(clearResult.stdout) as Record<string, unknown>;
    expect(todo.assignee).toBeNull();
    expect(todo.assigneeLease).toBeNull();
  });

  test("rejects using --tag and --tag-id together", () => {
    runCli(["tag", "add", "--path", "work/backend"], configDir);
    runCli(["todo", "add", "--description", "task", "--status", "todo"], configDir);

    const result = runCli(
      ["todo", "update", "--id", "1", "--tag", "work/backend", "--tag-id", "2"],
      configDir
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Use either --tag or --tag-id, not both");
  });

  test("rejects non-integer --id via Cliffy type validation", () => {
    const result = runCli(["todo", "update", "--id", "1.2", "--status", "todo"], configDir);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Option "--id" must be of type "integer", but got "1.2"');
  });

  test("rejects invalid --assignee-lease via custom type", () => {
    runCli(["todo", "add", "--description", "assignable", "--status", "todo"], configDir);

    const result = runCli(["todo", "update", "--id", "1", "--assignee-lease", "2031-04-15T09:30:00"], configDir);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      'Option "--assignee-lease" must use YYYY-MM-DD HH:MM:SS, but got "2031-04-15T09:30:00"'
    );
  });

  test("clear-predecessors takes precedence over --predecessors", () => {
    runCli(["todo", "add", "--description", "a", "--status", "in_progress"], configDir);
    runCli(["todo", "add", "--description", "b", "--status", "in_progress"], configDir);
    runCli(["todo", "add", "--description", "c", "--status", "todo", "--predecessors", "1"], configDir);

    const updateResult = runCli(
      ["todo", "update", "--id", "3", "--predecessors", "1,2", "--clear-predecessors"],
      configDir
    );

    expect(updateResult.exitCode).toBe(0);

    const fetched = runCli(["todo", "get", "--ids", "3"], configDir);
    const rows = Bun.JSON5.parse(fetched.stdout) as Array<Record<string, unknown>>;
    expect(rows[0]?.isBlocked).toBe(false);
  });

  test("supports setting status to cancelled", () => {
    runCli(["todo", "add", "--description", "to-cancel", "--status", "todo"], configDir);

    const result = runCli(["todo", "update", "--id", "1", "--status", "cancelled"], configDir);

    expect(result.exitCode).toBe(0);
    const todo = Bun.JSON5.parse(result.stdout) as Record<string, unknown>;
    expect(todo.status).toBe("cancelled");
  });
});
