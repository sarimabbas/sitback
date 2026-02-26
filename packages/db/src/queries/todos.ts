import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { todosTable } from "../schema";
import type { DbClient, TodoInsert, TodoUpdate } from "./types";
import { addDependency, replaceTodoPredecessors } from "./dependencies";
import { ensureTagPath } from "./tags";

type TodoRowWithBlocked = {
  id: number;
  description: string;
  tagId: number | null;
  status: "todo" | "in_progress" | "completed" | "cancelled";
  assignee: string | null;
  assigneeLease: string | null;
  workNotes: string | null;
  priority: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  isBlocked: number;
};

type TodoStatus = "todo" | "in_progress" | "completed" | "cancelled";
type TodoGetSortBy = "id" | "priority" | "due_date" | "created_at" | "updated_at";
type TodoGetSortOrder = "asc" | "desc";

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
    assignee: todosTable.assignee,
    assigneeLease: todosTable.assigneeLease,
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

function buildGetConditions(
  options: {
    blocked?: boolean;
    statuses?: TodoStatus[];
    minPriority?: number;
    dueBefore?: string;
    dueAfter?: string;
    tagId?: number;
    assignee?: string;
    hasAssignee?: boolean;
    leaseExpired?: boolean;
  },
  blockedExpr: ReturnType<typeof sql>
) {
  const conditions = [] as ReturnType<typeof sql>[];

  if (options.statuses && options.statuses.length > 0) {
    conditions.push(inArray(todosTable.status, options.statuses) as unknown as ReturnType<typeof sql>);
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
    conditions.push(tagSubtreeCondition(todosTable.tagId, options.tagId));
  }

  if (options.assignee !== undefined) {
    conditions.push(eq(todosTable.assignee, options.assignee) as unknown as ReturnType<typeof sql>);
  }

  if (options.hasAssignee !== undefined) {
    conditions.push(
      options.hasAssignee ? sql`${todosTable.assignee} is not null` : sql`${todosTable.assignee} is null`
    );
  }

  if (options.leaseExpired !== undefined) {
    conditions.push(
      options.leaseExpired
        ? sql`${todosTable.assigneeLease} is not null and ${todosTable.assigneeLease} <= CURRENT_TIMESTAMP`
        : sql`${todosTable.assigneeLease} is null or ${todosTable.assigneeLease} > CURRENT_TIMESTAMP`
    );
  }

  return conditions;
}

function getOrderByClauses(sortBy?: TodoGetSortBy, sortOrder?: TodoGetSortOrder) {
  const order = sortOrder ?? "asc";
  const idTieBreaker = asc(todosTable.id);

  if (!sortBy) {
    return [
      sql`coalesce(${todosTable.dueDate}, '9999-12-31') asc`,
      sql`coalesce(${todosTable.priority}, 0) desc`,
      idTieBreaker
    ] as const;
  }

  const direction = order === "asc" ? asc : desc;

  if (sortBy === "due_date") {
    return [direction(sql`coalesce(${todosTable.dueDate}, '9999-12-31')`), idTieBreaker] as const;
  }

  if (sortBy === "priority") {
    return [direction(sql`coalesce(${todosTable.priority}, 0)`), idTieBreaker] as const;
  }

  if (sortBy === "created_at") {
    return [direction(todosTable.createdAt), idTieBreaker] as const;
  }

  if (sortBy === "updated_at") {
    return [direction(todosTable.updatedAt), idTieBreaker] as const;
  }

  return [direction(todosTable.id)] as const;
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

function tagSubtreeCondition(tagColumn: unknown, tagId: number) {
  // Recursive CTE walkthrough:
  // 1) Seed descendants with the requested tagId.
  // 2) Repeatedly add tags whose parent_id is already in descendants.
  // 3) Stop when no new children are found.
  // The final set contains tagId + all nested children, so filters/claims scoped
  // to a lane tag automatically include its full subtree.
  return sql`${tagColumn} in (
    with recursive descendants(id) as (
      select ${tagId}
      union all
      select t.id
      from tags t
      join descendants d on t.parent_id = d.id
    )
    select id from descendants
  )`;
}

function claimableConditions(options: { id?: number; tagId?: number }) {
  const conditions = [
    inArray(todosTable.status, ["todo", "in_progress"]),
    sql`not (${blockedExistsSql(todosTable.id)})`,
    sql`(${todosTable.assignee} is null or (${todosTable.assignee} is not null and ${todosTable.assigneeLease} <= CURRENT_TIMESTAMP))`
  ] as ReturnType<typeof sql>[];

  if (options.id !== undefined) {
    conditions.push(eq(todosTable.id, options.id) as unknown as ReturnType<typeof sql>);
  }

  if (options.tagId !== undefined) {
    conditions.push(tagSubtreeCondition(todosTable.tagId, options.tagId));
  }

  return conditions;
}

export async function claimTodo(
  db: DbClient,
  input: {
    assignee: string;
    leaseMinutes: number;
    id?: number;
    tagId?: number;
  }
) {
  const leaseExpr = sql<string>`datetime('now', '+' || ${input.leaseMinutes} || ' minutes')`;

  const tagFilterSql =
    input.tagId !== undefined
      ? sql`and c.tag_id in (
          with recursive descendants(id) as (
            select ${input.tagId}
            union all
            select t.id
            from tags t
            join descendants d on t.parent_id = d.id
          )
          select id from descendants
        )`
      : sql``;

  if (input.id !== undefined) {
    const [claimed] = await db
      .update(todosTable)
      .set({
        status: "in_progress",
        assignee: input.assignee,
        assigneeLease: leaseExpr
      })
      .where(and(...claimableConditions({ id: input.id, tagId: input.tagId })))
      .returning({ id: todosTable.id });

    if (!claimed) {
      return undefined;
    }

    return getTodoById(db, claimed.id);
  }

  const [claimed] = await db
    .update(todosTable)
    .set({
      status: "in_progress",
      assignee: input.assignee,
      assigneeLease: leaseExpr
    })
    .where(sql`${todosTable.id} = (
      select c.id
      from todos c
      where c.status in ('todo', 'in_progress')
        and not exists (
          select 1
          from todo_dependencies d
          join todos p on p.id = d.predecessor_id
          where d.successor_id = c.id
            and p.status != 'completed'
        )
        and (c.assignee is null or (c.assignee is not null and c.assignee_lease <= CURRENT_TIMESTAMP))
        ${tagFilterSql}
      order by coalesce(c.due_date, '9999-12-31') asc, coalesce(c.priority, 0) desc, c.id asc
      limit 1
    )`)
    .returning({ id: todosTable.id });

  if (!claimed) {
    return undefined;
  }

  return getTodoById(db, claimed.id);
}

export async function getTodosForGet(
  db: DbClient,
  options: {
    limit: number;
    blocked?: boolean;
    statuses?: TodoStatus[];
    minPriority?: number;
    dueBefore?: string;
    dueAfter?: string;
    tagId?: number;
    assignee?: string;
    hasAssignee?: boolean;
    leaseExpired?: boolean;
    sortBy?: TodoGetSortBy;
    sortOrder?: TodoGetSortOrder;
  }
) {
  const blockedExpr = blockedExistsSql(todosTable.id);
  const conditions = buildGetConditions(options, blockedExpr);

  const rows = await db
    .select(todosWithBlockedSelection())
    .from(todosTable)
    .where(conditions.length === 0 ? undefined : and(...conditions))
    .orderBy(...getOrderByClauses(options.sortBy, options.sortOrder))
    .limit(options.limit);

  return rows.map(mapBlocked);
}

export async function countTodosForGet(
  db: DbClient,
  options: {
    blocked?: boolean;
    statuses?: TodoStatus[];
    minPriority?: number;
    dueBefore?: string;
    dueAfter?: string;
    tagId?: number;
    assignee?: string;
    hasAssignee?: boolean;
    leaseExpired?: boolean;
  }
) {
  const blockedExpr = blockedExistsSql(todosTable.id);
  const conditions = buildGetConditions(options, blockedExpr);

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(todosTable)
    .where(conditions.length === 0 ? undefined : and(...conditions));

  return result?.count ?? 0;
}

export async function addTodo(
  db: DbClient,
  input: {
    description: string;
    status?: TodoStatus;
    tagPath?: string;
    predecessorIds?: number[];
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
