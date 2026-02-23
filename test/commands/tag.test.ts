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

  test("tag get returns tag tree and recursive todo count", () => {
    runCli(["tag", "add", "--path", "root/child/grandchild"], configDir);
    runCli(["todo", "add", "--description", "on child", "--tag", "root/child", "--status", "todo"], configDir);
    runCli(
      ["todo", "add", "--description", "on grandchild", "--tag", "root/child/grandchild", "--status", "todo"],
      configDir
    );

    const result = runCli(["tag", "get", "--id", "2"], configDir);

    expect(result.exitCode).toBe(0);
    const payload = Bun.JSON5.parse(result.stdout) as {
      tag: { id: number; name: string; parentId: number | null };
      tagTree: {
        id: number;
        name: string;
        parentId: number | null;
        children: Array<{ id: number; name: string; parentId: number | null; children: unknown[] }>;
      };
      todoCount: number;
    };

    expect(payload.tag.id).toBe(2);
    expect(payload.tag.name).toBe("child");
    expect(payload.tagTree.id).toBe(2);
    expect(payload.tagTree.children).toHaveLength(1);
    expect(payload.tagTree.children[0]?.name).toBe("grandchild");
    expect(payload.todoCount).toBe(2);
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
