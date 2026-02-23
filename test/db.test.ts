import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { applySqlitePragmas } from "@/db/pragmas";
import { addDependency, getReadyTodos } from "@/db/queries";
import { tagsTable, todoDependenciesTable, todosTable } from "@/db/schema";

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

  db = drizzle({ connection: { url: `file:${dbFilePath}` } });
  await applySqlitePragmas(db);

  await migrate(db, {
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
