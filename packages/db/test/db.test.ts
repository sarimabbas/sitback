import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { applySqlitePragmas } from "@/pragmas";
import {
  addDependency,
  claimTodo,
  addTodo,
  createTodo,
  createTag,
  deleteTodo,
  deleteTag,
  getExportTree,
  getNextTodos,
  getReadyTodos,
  getTagById,
  getTags,
  getTodoById,
  getTodosByIds,
  getTodos,
  getTodosForGet,
  updateTag,
  updateTodo
} from "@/queries";
import { tagsTable, todoDependenciesTable, todosTable } from "@/schema";

type TestDb = ReturnType<typeof drizzle>;

let db: TestDb;
let tempDir = "";

function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "sitback-test-"));
  const dbFilePath = join(tempDir, "test.db");

  db = drizzle(dbFilePath);
  await applySqlitePragmas(db);

  migrate(db, {
    migrationsFolder: join(import.meta.dir, "..", "drizzle")
  });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("db schema", () => {
  test("can insert and query a todo with a tag", async () => {
    const [rawTag] = await db.insert(tagsTable).values({ name: "work" }).returning();
    const tag = requireValue(rawTag, "Expected inserted tag row");

    await db.insert(todosTable).values({
      description: "Write initial tests",
      status: "todo",
      tagId: tag.id
    });

    const rows = await db
      .select()
      .from(todosTable)
      .where(eq(todosTable.description, "Write initial tests"));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("todo");
    expect(rows[0]?.tagId).toBe(tag.id);
  });

  test("supports todo CRUD query helpers", async () => {
    const created = await createTodo(db, {
      description: "ship-crud",
      status: "todo",
      workNotes: "Initial draft",
      priority: 3,
      dueDate: "2030-01-01"
    });
    const createdTodo = requireValue(created, "Expected created todo row");
    expect(createdTodo.createdAt.length).toBeGreaterThan(0);
    expect(createdTodo.updatedAt.length).toBeGreaterThan(0);

    const updated = await updateTodo(db, createdTodo.id, {
      description: "ship-crud-v2",
      status: "in_progress",
      workNotes: "Updated notes",
      priority: 4
    });
    const updatedTodo = requireValue(updated, "Expected updated todo row");

    expect(updatedTodo.description).toBe("ship-crud-v2");
    expect(updatedTodo.status).toBe("in_progress");
    expect(updatedTodo.workNotes).toBe("Updated notes");
    expect(updatedTodo.priority).toBe(4);

    const fetched = await getTodoById(db, createdTodo.id);
    const fetchedTodo = requireValue(fetched, "Expected fetched todo row");

    expect(fetchedTodo.id).toBe(createdTodo.id);
    expect(fetchedTodo.dueDate).toBe("2030-01-01");

    await Bun.sleep(1100);
    await updateTodo(db, createdTodo.id, { workNotes: "Touched" });
    const touchedTodo = requireValue(await getTodoById(db, createdTodo.id), "Expected touched todo row");
    expect(touchedTodo.updatedAt >= createdTodo.updatedAt).toBe(true);

    const deleted = await deleteTodo(db, createdTodo.id);
    const deletedTodo = requireValue(deleted, "Expected deleted todo row");

    expect(deletedTodo.id).toBe(createdTodo.id);
    expect(await getTodoById(db, createdTodo.id)).toBeUndefined();
  });

  test("rejects todo priority outside 1-5", async () => {
    let failed = false;

    try {
      await createTodo(db, {
        description: "bad priority",
        status: "todo",
        priority: 6
      });
    } catch {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  test("returns blocked state for todos", async () => {
    const mapA = requireValue(
      await createTodo(db, { description: "map-a", status: "completed" }),
      "Expected map-a todo row"
    );
    const mapB = requireValue(
      await createTodo(db, { description: "map-b", status: "todo" }),
      "Expected map-b todo row"
    );
    const reducer = requireValue(
      await createTodo(db, { description: "reduce", status: "todo" }),
      "Expected reducer todo row"
    );

    await addDependency(db, reducer.id, mapA.id);
    await addDependency(db, reducer.id, mapB.id);

    const before = requireValue(await getTodoById(db, reducer.id), "Expected reducer todo row");
    expect(before.isBlocked).toBe(true);

    await updateTodo(db, mapB.id, { status: "completed" });

    const allTodos = await getTodos(db);
    const reducerAfter = allTodos.find((todo) => todo.id === reducer.id);

    expect(reducerAfter?.isBlocked).toBe(false);
  });

  test("getTodosByIds returns requested todos in ID order", async () => {
    const todoA = requireValue(
      await createTodo(db, { description: "a", status: "todo" }),
      "Expected todo A"
    );
    const todoB = requireValue(
      await createTodo(db, { description: "b", status: "completed" }),
      "Expected todo B"
    );

    const todos = await getTodosByIds(db, [todoB.id, todoA.id, todoA.id]);

    expect(todos).toHaveLength(2);
    expect(todos[0]?.id).toBe(todoB.id);
    expect(todos[1]?.id).toBe(todoA.id);
  });

  test("getNextTodos returns unblocked todo items with default scheduling behavior", async () => {
    const predecessor = requireValue(
      await createTodo(db, { description: "map", status: "in_progress" }),
      "Expected predecessor"
    );
    const blocked = requireValue(
      await createTodo(db, { description: "reduce", status: "todo" }),
      "Expected blocked todo"
    );
    const readyA = requireValue(
      await createTodo(db, { description: "ready-a", status: "todo" }),
      "Expected ready A"
    );
    const readyB = requireValue(
      await createTodo(db, { description: "ready-b", status: "todo" }),
      "Expected ready B"
    );

    await addDependency(db, blocked.id, predecessor.id);

    const nextOne = await getNextTodos(db, 1);

    expect(nextOne).toHaveLength(1);
    expect(nextOne[0]?.id).toBe(readyA.id);
    expect(nextOne[0]?.isBlocked).toBe(false);

    const nextTwo = await getNextTodos(db, 2);
    expect(nextTwo).toHaveLength(2);
    expect(nextTwo[0]?.id).toBe(readyA.id);
    expect(nextTwo[1]?.id).toBe(readyB.id);
  });

  test("getNextTodos prioritizes earlier due dates, then higher priority", async () => {
    const lateHigh = requireValue(
      await createTodo(db, {
        description: "late-high",
        status: "todo",
        dueDate: "2031-12-01",
        priority: 5
      }),
      "Expected late-high todo"
    );
    const soonLow = requireValue(
      await createTodo(db, {
        description: "soon-low",
        status: "todo",
        dueDate: "2030-01-01",
        priority: 1
      }),
      "Expected soon-low todo"
    );
    const soonHigh = requireValue(
      await createTodo(db, {
        description: "soon-high",
        status: "todo",
        dueDate: "2030-01-01",
        priority: 4
      }),
      "Expected soon-high todo"
    );

    const next = await getNextTodos(db, 3);

    expect(next[0]?.id).toBe(soonHigh.id);
    expect(next[1]?.id).toBe(soonLow.id);
    expect(next[2]?.id).toBe(lateHigh.id);
  });

  test("claimTodo picks best actionable todo and sets assignee lease", async () => {
    const blocker = requireValue(
      await createTodo(db, { description: "blocker", status: "in_progress" }),
      "Expected blocker"
    );
    const blocked = requireValue(
      await createTodo(db, { description: "blocked", status: "todo", dueDate: "2030-01-01" }),
      "Expected blocked todo"
    );
    const readyLate = requireValue(
      await createTodo(db, { description: "ready-late", status: "todo", dueDate: "2030-02-01" }),
      "Expected ready-late"
    );
    const readySoon = requireValue(
      await createTodo(db, { description: "ready-soon", status: "todo", dueDate: "2030-01-02" }),
      "Expected ready-soon"
    );

    await addDependency(db, blocked.id, blocker.id);

    const claimed = requireValue(
      await claimTodo(db, {
        assignee: "worker-1",
        leaseMinutes: 15
      }),
      "Expected claimed todo"
    );

    expect(claimed.id).toBe(readySoon.id);
    expect(claimed.status).toBe("in_progress");
    expect(claimed.assignee).toBe("worker-1");
    expect(claimed.assigneeLease).toBeDefined();

    const fetchedLate = requireValue(await getTodoById(db, readyLate.id), "Expected ready-late todo");
    expect(fetchedLate.assignee).toBeNull();
  });

  test("claimTodo can claim an explicitly requested todo id", async () => {
    const todoA = requireValue(
      await createTodo(db, { description: "task-a", status: "todo" }),
      "Expected todo A"
    );
    const todoB = requireValue(
      await createTodo(db, { description: "task-b", status: "todo" }),
      "Expected todo B"
    );

    const claimed = requireValue(
      await claimTodo(db, {
        assignee: "worker-2",
        leaseMinutes: 30,
        id: todoB.id
      }),
      "Expected claimed todo"
    );

    expect(claimed.id).toBe(todoB.id);
    expect(claimed.assignee).toBe("worker-2");

    const untouched = requireValue(await getTodoById(db, todoA.id), "Expected untouched todo");
    expect(untouched.assignee).toBeNull();
  });

  test("claimTodo returns undefined when todo is already assigned with active lease", async () => {
    const claimed = requireValue(
      await createTodo(db, {
        description: "claimed",
        status: "in_progress",
        assignee: "worker-1",
        assigneeLease: "9999-01-01 00:00:00"
      }),
      "Expected claimed todo"
    );

    const result = await claimTodo(db, {
      assignee: "worker-2",
      leaseMinutes: 15,
      id: claimed.id
    });

    expect(result).toBeUndefined();
  });

  test("claimTodo can reclaim a todo when lease is expired", async () => {
    const stale = requireValue(
      await createTodo(db, {
        description: "stale",
        status: "in_progress",
        assignee: "worker-1",
        assigneeLease: "2000-01-01 00:00:00"
      }),
      "Expected stale todo"
    );

    const claimed = requireValue(
      await claimTodo(db, {
        assignee: "worker-2",
        leaseMinutes: 5
      }),
      "Expected reclaimed todo"
    );

    expect(claimed.id).toBe(stale.id);
    expect(claimed.assignee).toBe("worker-2");
  });

  test("getTodosForGet applies blocked, min-priority, and due date filters", async () => {
    const blocker = requireValue(
      await createTodo(db, {
        description: "blocker",
        status: "in_progress",
        dueDate: "2030-01-01",
        priority: 3
      }),
      "Expected blocker"
    );
    const blockedTodo = requireValue(
      await createTodo(db, {
        description: "blocked",
        status: "todo",
        dueDate: "2030-01-05",
        priority: 5
      }),
      "Expected blocked todo"
    );
    const readySoon = requireValue(
      await createTodo(db, {
        description: "ready-soon",
        status: "todo",
        dueDate: "2030-01-03",
        priority: 4
      }),
      "Expected ready soon"
    );
    const readyLateLow = requireValue(
      await createTodo(db, {
        description: "ready-late-low",
        status: "todo",
        dueDate: "2030-02-01",
        priority: 1
      }),
      "Expected ready late low"
    );

    await addDependency(db, blockedTodo.id, blocker.id);

    const blockedOnly = await getTodosForGet(db, {
      limit: 5,
      actionableOnly: false,
      blocked: true
    });
    expect(blockedOnly.some((todo) => todo.id === blockedTodo.id)).toBe(true);

    const filteredReady = await getTodosForGet(db, {
      limit: 5,
      actionableOnly: true,
      minPriority: 3,
      dueBefore: "2030-01-31"
    });

    expect(filteredReady.map((todo) => todo.id)).toEqual([readySoon.id]);
    expect(filteredReady.some((todo) => todo.id === readyLateLow.id)).toBe(false);
  });

  test("addTodo upserts tag path and attaches predecessors", async () => {
    const predecessorA = requireValue(
      await createTodo(db, { description: "map-a", status: "completed" }),
      "Expected predecessor A"
    );
    const predecessorB = requireValue(
      await createTodo(db, { description: "map-b", status: "in_progress" }),
      "Expected predecessor B"
    );

    const added = requireValue(
      await addTodo(db, {
        description: "reduce",
        status: "todo",
        tagPath: "work/backend",
        predecessorIds: [predecessorA.id, predecessorB.id],
        workNotes: "Need to verify reducer output",
        priority: 2,
        dueDate: "2030-01-01"
      }),
      "Expected added todo"
    );

    expect(added.description).toBe("reduce");
    expect(added.status).toBe("todo");
    expect(added.isBlocked).toBe(true);
    expect(added.tagId).toBeDefined();
    expect(added.workNotes).toBe("Need to verify reducer output");
    expect(added.priority).toBe(2);
    expect(added.dueDate).toBe("2030-01-01");

    const tags = await getTags(db);
    const work = tags.find((tag) => tag.name === "work" && tag.parentId === null);
    const backend = tags.find((tag) => tag.name === "backend");

    expect(work).toBeDefined();
    expect(backend?.parentId).toBe(work?.id);

    const dependencies = await db
      .select()
      .from(todoDependenciesTable)
      .where(eq(todoDependenciesTable.successorId, added.id));

    expect(dependencies).toHaveLength(2);
  });

  test("rejects duplicate root tag names", async () => {
    await db.insert(tagsTable).values({ name: "foo" });

    let failed = false;

    try {
      await db.insert(tagsTable).values({ name: "foo" }).execute();
    } catch {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  test("supports tag CRUD query helpers", async () => {
    const created = await createTag(db, { name: "alpha" });
    const createdTag = requireValue(created, "Expected created tag row");

    const updated = await updateTag(db, createdTag.id, { name: "alphav2" });
    const updatedTag = requireValue(updated, "Expected updated tag row");

    expect(updatedTag.name).toBe("alphav2");

    const fetched = await getTagById(db, createdTag.id);
    const fetchedTag = requireValue(fetched, "Expected fetched tag row");

    expect(fetchedTag.id).toBe(createdTag.id);

    const tags = await getTags(db);
    expect(tags.some((tag) => tag.id === createdTag.id)).toBe(true);

    const deleted = await deleteTag(db, createdTag.id);
    const deletedTag = requireValue(deleted, "Expected deleted tag row");

    expect(deletedTag.id).toBe(createdTag.id);
    expect(await getTagById(db, createdTag.id)).toBeUndefined();
  });

  test("deleting a parent tag cascades and deletes children", async () => {
    const parent = requireValue(await createTag(db, { name: "parent" }), "Expected parent tag row");
    const child = requireValue(
      await createTag(db, { name: "child", parentId: parent.id }),
      "Expected child tag row"
    );
    const taggedTodo = requireValue(
      await createTodo(db, {
        description: "tagged",
        status: "todo",
        tagId: child.id
      }),
      "Expected tagged todo row"
    );

    await deleteTag(db, parent.id);

    expect(await getTagById(db, parent.id)).toBeUndefined();
    expect(await getTagById(db, child.id)).toBeUndefined();

    const fetchedTodo = requireValue(await getTodoById(db, taggedTodo.id), "Expected tagged todo row");
    expect(fetchedTodo.tagId).toBeNull();
  });

  test("exports tag and todo trees with blocked status", async () => {
    const parentTag = requireValue(
      await createTag(db, { name: "work" }),
      "Expected parent tag row"
    );
    const childTag = requireValue(
      await createTag(db, { name: "backend", parentId: parentTag.id }),
      "Expected child tag row"
    );

    const mapTodo = requireValue(
      await createTodo(db, { description: "map", status: "in_progress", tagId: childTag.id }),
      "Expected map todo row"
    );
    const reduceTodo = requireValue(
      await createTodo(db, { description: "reduce", status: "todo", tagId: childTag.id }),
      "Expected reduce todo row"
    );

    await addDependency(db, reduceTodo.id, mapTodo.id);

    const exported = await getExportTree(db);

    expect(exported.tagTree).toHaveLength(1);
    expect(exported.tagTree[0]?.name).toBe("work");
    expect(exported.tagTree[0]?.children[0]?.name).toBe("backend");

    const mapNode = exported.todoTree.find((todo) => todo.id === mapTodo.id);
    const reduceNode = mapNode?.children.find((todo) => todo.id === reduceTodo.id);

    expect(reduceNode?.isBlocked).toBe(true);
  });

  test("rejects non-lowercase tag names", async () => {
    let failed = false;

    try {
      await db.insert(tagsTable).values({ name: "Foo" }).execute();
    } catch {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  test("rejects tags with spaces or special characters", async () => {
    let failedWithSpace = false;
    let failedWithDash = false;

    try {
      await db.insert(tagsTable).values({ name: "foo bar" }).execute();
    } catch {
      failedWithSpace = true;
    }

    try {
      await db.insert(tagsTable).values({ name: "foo-bar" }).execute();
    } catch {
      failedWithDash = true;
    }

    expect(failedWithSpace).toBe(true);
    expect(failedWithDash).toBe(true);
  });

  test("allows lowercase alphanumeric tag names", async () => {
    await db.insert(tagsTable).values({ name: "foo123" }).execute();

    const rows = await db.select().from(tagsTable).where(eq(tagsTable.name, "foo123"));

    expect(rows).toHaveLength(1);
  });

  test("rejects duplicate child tag names under the same parent", async () => {
    const [rawParent] = await db.insert(tagsTable).values({ name: "foo" }).returning();
    const parent = requireValue(rawParent, "Expected inserted parent tag row");

    await db.insert(tagsTable).values({ name: "bar", parentId: parent.id });

    let failed = false;

    try {
      await db.insert(tagsTable).values({ name: "bar", parentId: parent.id }).execute();
    } catch {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  test("allows the same child tag name under different parents", async () => {
    const [rawParentA] = await db.insert(tagsTable).values({ name: "foo" }).returning();
    const [rawParentB] = await db.insert(tagsTable).values({ name: "baz" }).returning();
    const parentA = requireValue(rawParentA, "Expected first inserted parent tag row");
    const parentB = requireValue(rawParentB, "Expected second inserted parent tag row");

    await db.insert(tagsTable).values({ name: "bar", parentId: parentA.id });
    await db.insert(tagsTable).values({ name: "bar", parentId: parentB.id });

    const bars = await db.select().from(tagsTable).where(eq(tagsTable.name, "bar"));

    expect(bars).toHaveLength(2);
  });

  test("supports multiple predecessors for a single todo", async () => {
    const [rawMapA] = await db
      .insert(todosTable)
      .values({ description: "map-a", status: "completed" })
      .returning();
    const [rawMapB] = await db
      .insert(todosTable)
      .values({ description: "map-b", status: "completed" })
      .returning();
    const [rawReducer] = await db
      .insert(todosTable)
      .values({ description: "reduce", status: "todo" })
      .returning();

    const mapA = requireValue(rawMapA, "Expected map-a todo row");
    const mapB = requireValue(rawMapB, "Expected map-b todo row");
    const reducer = requireValue(rawReducer, "Expected reducer todo row");

    await addDependency(db, reducer.id, mapA.id);
    await addDependency(db, reducer.id, mapB.id);

    const dependencies = await db
      .select()
      .from(todoDependenciesTable)
      .where(eq(todoDependenciesTable.successorId, reducer.id));

    expect(dependencies).toHaveLength(2);
  });

  test("returns reducer todo only when all predecessors are completed", async () => {
    const [rawMapA] = await db
      .insert(todosTable)
      .values({ description: "map-a", status: "completed" })
      .returning();
    const [rawMapB] = await db
      .insert(todosTable)
      .values({ description: "map-b", status: "in_progress" })
      .returning();
    const [rawReducer] = await db
      .insert(todosTable)
      .values({ description: "reduce", status: "todo" })
      .returning();

    const mapA = requireValue(rawMapA, "Expected map-a todo row");
    const mapB = requireValue(rawMapB, "Expected map-b todo row");
    const reducer = requireValue(rawReducer, "Expected reducer todo row");

    await addDependency(db, reducer.id, mapA.id);
    await addDependency(db, reducer.id, mapB.id);

    const readyBefore = await getReadyTodos(db);
    const reducerReadyBefore = readyBefore.some((todo) => todo.id === reducer.id);

    expect(reducerReadyBefore).toBe(false);

    await db
      .update(todosTable)
      .set({ status: "completed" })
      .where(eq(todosTable.id, mapB.id));

    const readyAfter = await getReadyTodos(db);
    const reducerReadyAfter = readyAfter.some((todo) => todo.id === reducer.id);

    expect(reducerReadyAfter).toBe(true);
  });

  test("deleting a predecessor removes dependency relation", async () => {
    const predecessor = requireValue(
      await createTodo(db, { description: "map-a", status: "in_progress" }),
      "Expected predecessor todo row"
    );
    const successor = requireValue(
      await createTodo(db, { description: "reduce", status: "todo" }),
      "Expected successor todo row"
    );

    await addDependency(db, successor.id, predecessor.id);

    const beforeDelete = requireValue(
      await getTodoById(db, successor.id),
      "Expected successor todo before delete"
    );
    expect(beforeDelete.isBlocked).toBe(true);

    await deleteTodo(db, predecessor.id);

    const dependencies = await db
      .select()
      .from(todoDependenciesTable)
      .where(eq(todoDependenciesTable.successorId, successor.id));
    expect(dependencies).toHaveLength(0);

    const afterDelete = requireValue(
      await getTodoById(db, successor.id),
      "Expected successor todo after delete"
    );
    expect(afterDelete.isBlocked).toBe(false);
  });

  test("rejects completing a todo when any predecessor is not completed", async () => {
    const predecessor = requireValue(
      await createTodo(db, { description: "map-a", status: "in_progress" }),
      "Expected predecessor todo row"
    );
    const successor = requireValue(
      await createTodo(db, { description: "reduce", status: "todo" }),
      "Expected successor todo row"
    );

    await addDependency(db, successor.id, predecessor.id);

    let failed = false;

    try {
      await updateTodo(db, successor.id, { status: "completed" });
    } catch {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  test("allows completing a todo after all predecessors are completed", async () => {
    const predecessor = requireValue(
      await createTodo(db, { description: "map-a", status: "completed" }),
      "Expected predecessor todo row"
    );
    const successor = requireValue(
      await createTodo(db, { description: "reduce", status: "todo" }),
      "Expected successor todo row"
    );

    await addDependency(db, successor.id, predecessor.id);

    const updated = await updateTodo(db, successor.id, { status: "completed" });
    const updatedTodo = requireValue(updated, "Expected updated successor todo row");

    expect(updatedTodo.status).toBe("completed");
  });

  test("rejects cyclic todo dependencies", async () => {
    const [rawTodoA] = await db
      .insert(todosTable)
      .values({ description: "a", status: "todo" })
      .returning();
    const [rawTodoB] = await db
      .insert(todosTable)
      .values({ description: "b", status: "todo" })
      .returning();

    const todoA = requireValue(rawTodoA, "Expected todo A row");
    const todoB = requireValue(rawTodoB, "Expected todo B row");

    await addDependency(db, todoB.id, todoA.id);

    let failed = false;

    try {
      await addDependency(db, todoA.id, todoB.id);
    } catch {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  test("rejects cyclic tag parenting", async () => {
    const [rawFoo] = await db.insert(tagsTable).values({ name: "foo" }).returning();
    const foo = requireValue(rawFoo, "Expected foo tag row");

    const [rawBar] = await db
      .insert(tagsTable)
      .values({ name: "bar", parentId: foo.id })
      .returning();
    const bar = requireValue(rawBar, "Expected bar tag row");

    let failed = false;

    try {
      await db
        .update(tagsTable)
        .set({ parentId: bar.id })
        .where(eq(tagsTable.id, foo.id))
        .execute();
    } catch {
      failed = true;
    }

    expect(failed).toBe(true);
  });
});
