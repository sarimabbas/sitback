import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { todoDependenciesTable, todosTable } from "./schema";

type DbClient = ReturnType<typeof drizzle>;

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
