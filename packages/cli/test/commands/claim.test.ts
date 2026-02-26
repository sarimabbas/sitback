import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTempConfigDir, removeTempConfigDir, runCli } from "./helpers";

let configDir = "";

beforeEach(() => {
  configDir = createTempConfigDir("sitback-cli-claim-");
});

afterEach(() => {
  removeTempConfigDir(configDir);
});

describe("cli todo claim", () => {
  test("claims the best actionable todo by default", () => {
    runCli(["todo", "add", "--description", "blocked-parent", "--status", "in_progress"], configDir);
    runCli(["todo", "add", "--description", "blocked", "--status", "todo", "--predecessors", "1"], configDir);
    runCli(["todo", "add", "--description", "late", "--status", "todo", "--due-date", "2030-02-01"], configDir);
    runCli(["todo", "add", "--description", "soon", "--status", "todo", "--due-date", "2030-01-01"], configDir);

    const result = runCli(["todo", "claim", "--assignee", "worker-1"], configDir);

    expect(result.exitCode).toBe(0);
    const claimed = Bun.JSON5.parse(result.stdout) as Record<string, unknown>;
    expect(claimed.id).toBe(4);
    expect(claimed.status).toBe("in_progress");
    expect(claimed.assignee).toBe("worker-1");
    expect(typeof claimed.assigneeLease).toBe("string");
  });

  test("returns null when no claimable todos are available", () => {
    runCli(["todo", "add", "--description", "done", "--status", "completed"], configDir);

    const result = runCli(["todo", "claim", "--assignee", "worker-1"], configDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("null");
  });

  test("claims a specific todo id when requested", () => {
    runCli(["todo", "add", "--description", "task-a", "--status", "todo"], configDir);
    runCli(["todo", "add", "--description", "task-b", "--status", "todo"], configDir);

    const result = runCli([
      "todo",
      "claim",
      "--assignee",
      "worker-2",
      "--lease-minutes",
      "30",
      "--id",
      "2"
    ], configDir);

    expect(result.exitCode).toBe(0);
    const claimed = Bun.JSON5.parse(result.stdout) as Record<string, unknown>;
    expect(claimed.id).toBe(2);
    expect(claimed.assignee).toBe("worker-2");
  });

  test("fails when specific todo is not claimable", () => {
    runCli(["todo", "add", "--description", "task", "--status", "todo"], configDir);
    runCli(["todo", "claim", "--assignee", "worker-1", "--id", "1"], configDir);

    const result = runCli(["todo", "claim", "--assignee", "worker-2", "--id", "1"], configDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Todo 1 is not claimable");
  });

  test("claims only within tag subtree with --tag", () => {
    runCli([
      "todo",
      "add",
      "--description",
      "frontend-item",
      "--status",
      "todo",
      "--tag",
      "work/frontend",
      "--due-date",
      "2030-02-01"
    ], configDir);
    runCli([
      "todo",
      "add",
      "--description",
      "backend-item",
      "--status",
      "todo",
      "--tag",
      "work/backend",
      "--due-date",
      "2030-01-01"
    ], configDir);

    const result = runCli([
      "todo",
      "claim",
      "--assignee",
      "worker-3",
      "--tag",
      "work/frontend"
    ], configDir);

    expect(result.exitCode).toBe(0);
    const claimed = Bun.JSON5.parse(result.stdout) as Record<string, unknown>;
    expect(claimed.description).toBe("frontend-item");
    expect(claimed.assignee).toBe("worker-3");
  });

  test("claims only within tag subtree with --tag-id", () => {
    const add = runCli([
      "todo",
      "add",
      "--description",
      "frontend-item",
      "--status",
      "todo",
      "--tag",
      "work/frontend"
    ], configDir);
    const added = Bun.JSON5.parse(add.stdout) as Record<string, unknown>;
    const tagId = String(added.tagId as number);

    runCli([
      "todo",
      "add",
      "--description",
      "backend-item",
      "--status",
      "todo",
      "--tag",
      "work/backend"
    ], configDir);

    const result = runCli([
      "todo",
      "claim",
      "--assignee",
      "worker-4",
      "--tag-id",
      tagId
    ], configDir);

    expect(result.exitCode).toBe(0);
    const claimed = Bun.JSON5.parse(result.stdout) as Record<string, unknown>;
    expect(claimed.description).toBe("frontend-item");
    expect(claimed.assignee).toBe("worker-4");
  });

  test("errors when --tag and --tag-id are both provided", () => {
    runCli(["todo", "add", "--description", "task", "--status", "todo", "--tag", "work/frontend"], configDir);

    const result = runCli([
      "todo",
      "claim",
      "--assignee",
      "worker-1",
      "--tag",
      "work/frontend",
      "--tag-id",
      "1"
    ], configDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Use either --tag or --tag-id, not both");
  });

  test("errors for unknown tag path", () => {
    runCli(["todo", "add", "--description", "task", "--status", "todo"], configDir);

    const result = runCli([
      "todo",
      "claim",
      "--assignee",
      "worker-1",
      "--tag",
      "missing/path"
    ], configDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Tag path not found: missing/path");
  });

  test("errors for unknown tag id", () => {
    runCli(["todo", "add", "--description", "task", "--status", "todo"], configDir);

    const result = runCli([
      "todo",
      "claim",
      "--assignee",
      "worker-1",
      "--tag-id",
      "999"
    ], configDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Tag 999 not found");
  });

  test("requires assignee", () => {
    const result = runCli(["todo", "claim"], configDir);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Missing required option "--assignee"');
  });
});
