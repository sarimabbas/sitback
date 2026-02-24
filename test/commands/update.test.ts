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
});
