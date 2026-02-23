import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { tagsTable, todoDependenciesTable, todosTable } from "./schema";

type DbClient = ReturnType<typeof drizzle>;
type TodoInsert = typeof todosTable.$inferInsert;
type TodoUpdate = Partial<Pick<TodoInsert, "description" | "status" | "tagId">>;
type TagInsert = typeof tagsTable.$inferInsert;
type TagUpdate = Partial<Pick<TagInsert, "name" | "parentId">>;

async function queryTodoBlocked(db: DbClient, todoId: number): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(todoDependenciesTable)
    .innerJoin(todosTable, eq(todosTable.id, todoDependenciesTable.predecessorId))
    .where(
      and(eq(todoDependenciesTable.successorId, todoId), sql`${todosTable.status} != 'completed'`)
    );

  return (row?.count ?? 0) > 0;
}

export async function createTodo(db: DbClient, todo: TodoInsert) {
  const [created] = await db.insert(todosTable).values(todo).returning();

  return created;
}

export async function getTodoById(db: DbClient, id: number) {
  const [row] = await db.select().from(todosTable).where(eq(todosTable.id, id));

  if (!row) {
    return undefined;
  }

  return {
    ...row,
    isBlocked: await queryTodoBlocked(db, row.id)
  };
}

export async function getTodos(db: DbClient) {
  const rows = await db.select().from(todosTable);

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      isBlocked: await queryTodoBlocked(db, row.id)
    }))
  );
}

export async function updateTodo(db: DbClient, id: number, changes: TodoUpdate) {
  const [updated] = await db.update(todosTable).set(changes).where(eq(todosTable.id, id)).returning();

  return updated;
}

export async function deleteTodo(db: DbClient, id: number) {
  const [deleted] = await db.delete(todosTable).where(eq(todosTable.id, id)).returning();

  return deleted;
}

export async function createTag(db: DbClient, tag: TagInsert) {
  const [created] = await db.insert(tagsTable).values(tag).returning();

  return created;
}

export async function getTagById(db: DbClient, id: number) {
  const [row] = await db.select().from(tagsTable).where(eq(tagsTable.id, id));

  return row;
}

export async function getTags(db: DbClient) {
  return db.select().from(tagsTable);
}

export async function updateTag(db: DbClient, id: number, changes: TagUpdate) {
  const [updated] = await db.update(tagsTable).set(changes).where(eq(tagsTable.id, id)).returning();

  return updated;
}

export async function deleteTag(db: DbClient, id: number) {
  const [deleted] = await db.delete(tagsTable).where(eq(tagsTable.id, id)).returning();

  return deleted;
}

export async function getReadyTodos(db: DbClient) {
  return db
    .select()
    .from(todosTable)
    .where(
      and(
        eq(todosTable.status, "todo"),
        sql`not exists (
          select 1
          from todo_dependencies d
          join todos p on p.id = d.predecessor_id
          where d.successor_id = ${todosTable.id}
            and p.status != 'completed'
        )`
      )
    );
}

export async function addDependency(db: DbClient, successorId: number, predecessorId: number) {
  await db.insert(todoDependenciesTable).values({ successorId, predecessorId }).execute();
}
