import { and, eq, sql } from "drizzle-orm";
import { todoDependenciesTable, todosTable } from "../schema";
import type { DbClient, TodoInsert, TodoUpdate } from "./types";

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
