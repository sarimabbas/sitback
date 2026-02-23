import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTempConfigDir, removeTempConfigDir, runCli } from "./helpers";

let configDir = "";

beforeEach(() => {
  configDir = createTempConfigDir("sitback-cli-tag-");
});

afterEach(() => {
  removeTempConfigDir(configDir);
});

describe("cli tag", () => {
  test("tag add upserts slash path", () => {
    const addResult = runCli(["tag", "add", "--path", "work/backend"], configDir);

    expect(addResult.exitCode).toBe(0);
    const added = Bun.JSON5.parse(addResult.stdout) as Record<string, unknown>;
    expect(added.name).toBe("backend");

    const secondAddResult = runCli(["tag", "add", "--path", "work/backend"], configDir);
    const secondAdded = Bun.JSON5.parse(secondAddResult.stdout) as Record<string, unknown>;
    expect(secondAdded.id).toBe(added.id);
  });

  test("tag update renames by id", () => {
    const addResult = runCli(["tag", "add", "--path", "ops/platform"], configDir);
    const added = Bun.JSON5.parse(addResult.stdout) as Record<string, unknown>;

    const updateResult = runCli(
      ["tag", "update", "--id", String(added.id), "--name", "services"],
      configDir
    );

    expect(updateResult.exitCode).toBe(0);
    const updated = Bun.JSON5.parse(updateResult.stdout) as Record<string, unknown>;
    expect(updated.name).toBe("services");
  });

  test("tag delete cascades children and unlinks todos", () => {
    const parentAdd = runCli(["tag", "add", "--path", "engineering/backend"], configDir);
    const child = Bun.JSON5.parse(parentAdd.stdout) as Record<string, unknown>;

    const addTodo = runCli(
      [
        "todo",
        "add",
        "--description",
        "tagged task",
        "--tag",
        "engineering/backend",
        "--status",
        "todo"
      ],
      configDir
    );
    const todo = Bun.JSON5.parse(addTodo.stdout) as Record<string, unknown>;
    expect(todo.tagId).toBe(child.id);

    const deleteResult = runCli(["tag", "delete", "--id", "1"], configDir);
    expect(deleteResult.exitCode).toBe(0);

    const fetchedTodo = runCli(["todo", "get", "--ids", String(todo.id)], configDir);
    const rows = Bun.JSON5.parse(fetchedTodo.stdout) as Array<Record<string, unknown>>;
    expect(rows[0]?.tagId).toBeNull();
  });
});
