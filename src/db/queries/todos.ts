import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { todosTable } from "../schema";
import type { DbClient, TodoInsert, TodoUpdate } from "./types";
import { addDependency, replaceTodoPredecessors } from "./dependencies";
import { ensureTagPath } from "./tags";

type SchedulableTodo = {
  id: number;
  dueDate: string | null;
  priority: number | null;
};

type TodoRowWithBlocked = {
  id: number;
  description: string;
  tagId: number | null;
  status: "todo" | "in_progress" | "completed";
  inputArtifacts: string | null;
  outputArtifacts: string | null;
  workNotes: string | null;
  priority: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  isBlocked: number;
};

function compareTodosForScheduling(a: SchedulableTodo, b: SchedulableTodo): number {
  const aDueDate = a.dueDate ?? "9999-12-31";
  const bDueDate = b.dueDate ?? "9999-12-31";

  if (aDueDate !== bDueDate) {
    return aDueDate.localeCompare(bDueDate);
  }

  const aPriority = a.priority ?? 0;
  const bPriority = b.priority ?? 0;

  if (aPriority !== bPriority) {
    return bPriority - aPriority;
  }

  return a.id - b.id;
}

function blockedExistsSql(todoIdExpr: unknown) {
  return sql`exists (
    select 1
    from todo_dependencies d
    join todos p on p.id = d.predecessor_id
    where d.successor_id = ${todoIdExpr}
      and p.status != 'completed'
  )`;
}

function todosWithBlockedSelection() {
  return {
    id: todosTable.id,
    description: todosTable.description,
    tagId: todosTable.tagId,
    status: todosTable.status,
    inputArtifacts: todosTable.inputArtifacts,
    outputArtifacts: todosTable.outputArtifacts,
    workNotes: todosTable.workNotes,
    priority: todosTable.priority,
    dueDate: todosTable.dueDate,
    createdAt: todosTable.createdAt,
    updatedAt: todosTable.updatedAt,
    isBlocked: sql<number>`case when ${blockedExistsSql(todosTable.id)} then 1 else 0 end`
  };
}

function mapBlocked(row: TodoRowWithBlocked) {
  return {
    ...row,
    isBlocked: row.isBlocked === 1
  };
}

export async function createTodo(db: DbClient, todo: TodoInsert) {
  const [created] = await db.insert(todosTable).values(todo).returning();

  return created;
}

export async function getTodoById(db: DbClient, id: number) {
  const [row] = await db.select(todosWithBlockedSelection()).from(todosTable).where(eq(todosTable.id, id));

  if (!row) {
    return undefined;
  }

  return mapBlocked(row);
}

export async function getTodos(db: DbClient) {
  const rows = await db.select(todosWithBlockedSelection()).from(todosTable);

  return rows.map(mapBlocked);
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

export async function getTodosByIds(db: DbClient, ids: number[]) {
  const uniqueIds = Array.from(new Set(ids));

  if (uniqueIds.length === 0) {
    return [];
  }

  const rows = await db
    .select(todosWithBlockedSelection())
    .from(todosTable)
    .where(inArray(todosTable.id, uniqueIds));

  const rowsById = new Map(rows.map((row) => [row.id, mapBlocked(row)]));

  return uniqueIds.map((id) => rowsById.get(id)).filter((todo): todo is NonNullable<typeof todo> => todo !== undefined);
}

export async function getNextTodos(db: DbClient, limit: number) {
  return getTodosForGet(db, {
    limit,
    actionableOnly: true
  });
}

export async function getTodosForGet(
  db: DbClient,
  options: {
    limit: number;
    actionableOnly: boolean;
    blocked?: boolean;
    minPriority?: number;
    dueBefore?: string;
    dueAfter?: string;
    tagId?: number;
  }
) {
  const conditions = [] as ReturnType<typeof sql>[];
  const blockedExpr = blockedExistsSql(todosTable.id);

  if (options.actionableOnly) {
    conditions.push(eq(todosTable.status, "todo") as unknown as ReturnType<typeof sql>);
    conditions.push(sql`not (${blockedExpr})`);
  }

  if (options.blocked !== undefined) {
    conditions.push(options.blocked ? blockedExpr : sql`not (${blockedExpr})`);
  }

  if (options.minPriority !== undefined) {
    conditions.push(sql`${todosTable.priority} is not null and ${todosTable.priority} >= ${options.minPriority}`);
  }

  if (options.dueBefore) {
    conditions.push(sql`${todosTable.dueDate} is not null and ${todosTable.dueDate} <= ${options.dueBefore}`);
  }

  if (options.dueAfter) {
    conditions.push(sql`${todosTable.dueDate} is not null and ${todosTable.dueDate} >= ${options.dueAfter}`);
  }

  if (options.tagId !== undefined) {
    conditions.push(sql`${todosTable.tagId} in (
      with recursive descendants(id) as (
        select ${options.tagId}
        union all
        select t.id
        from tags t
        join descendants d on t.parent_id = d.id
      )
      select id from descendants
    )`);
  }

  const rows = await db
    .select(todosWithBlockedSelection())
    .from(todosTable)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(
      sql`coalesce(${todosTable.dueDate}, '9999-12-31') asc`,
      sql`coalesce(${todosTable.priority}, 0) desc`,
      asc(todosTable.id)
    )
    .limit(options.limit);

  return rows.map(mapBlocked).sort(compareTodosForScheduling);
}

export async function addTodo(
  db: DbClient,
  input: {
    description: string;
    status?: "todo" | "in_progress" | "completed";
    tagPath?: string;
    predecessorIds?: number[];
    inputArtifacts?: string;
    outputArtifacts?: string;
    workNotes?: string;
    priority?: number;
    dueDate?: string;
  }
) {
  const resolvedTag = input.tagPath ? await ensureTagPath(db, input.tagPath) : undefined;

  const created = await createTodo(db, {
    description: input.description,
    status: input.status ?? "todo",
    tagId: resolvedTag?.id,
    inputArtifacts: input.inputArtifacts,
    outputArtifacts: input.outputArtifacts,
    workNotes: input.workNotes,
    priority: input.priority,
    dueDate: input.dueDate
  });

  if (!created) {
    return undefined;
  }

  const predecessorIds = Array.from(new Set(input.predecessorIds ?? []));

  for (const predecessorId of predecessorIds) {
    await addDependency(db, created.id, predecessorId);
  }

  return getTodoById(db, created.id);
}

export async function updateTodoWithRelations(
  db: DbClient,
  input: {
    id: number;
    changes: TodoUpdate;
    predecessorIds?: number[];
  }
) {
  const existing = await getTodoById(db, input.id);
  if (!existing) {
    return undefined;
  }

  if (Object.keys(input.changes).length > 0) {
    await updateTodo(db, input.id, input.changes);
  }

  if (input.predecessorIds !== undefined) {
    await replaceTodoPredecessors(db, input.id, input.predecessorIds);
  }

  return getTodoById(db, input.id);
}
