import {
  check,
  foreignKey,
  int,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const todoStatusValues = ["todo", "in_progress", "completed"] as const;

export const tagsTable = sqliteTable(
  "tags",
  {
    id: int().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    parentId: int("parent_id")
  },
  (table) => [
    check("tags_name_lowercase_check", sql`${table.name} = lower(${table.name})`),
    check("tags_name_not_empty_check", sql`length(${table.name}) > 0`),
    check(
      "tags_name_alphanumeric_check",
      sql`${table.name} not glob '*[^a-z0-9]*'`
    ),
    uniqueIndex("tags_parent_name_unique").on(table.parentId, table.name),
    uniqueIndex("tags_root_name_unique")
      .on(table.name)
      .where(sql`${table.parentId} is null`),
    foreignKey({
      name: "tags_parent_fk",
      columns: [table.parentId],
      foreignColumns: [table.id]
    })
  ]
);

export const todosTable = sqliteTable(
  "todos",
  {
    id: int().primaryKey({ autoIncrement: true }),
    description: text().notNull(),
    tagId: int("tag_id"),
    status: text({ enum: todoStatusValues }).notNull().default("todo")
  },
  (table) => [
    foreignKey({
      name: "todos_tag_fk",
      columns: [table.tagId],
      foreignColumns: [tagsTable.id]
    }),
    check(
      "todos_status_check",
      sql`${table.status} in ('todo', 'in_progress', 'completed')`
    )
  ]
);

export const todoDependenciesTable = sqliteTable(
  "todo_dependencies",
  {
    successorId: int("successor_id").notNull(),
    predecessorId: int("predecessor_id").notNull()
  },
  (table) => [
    primaryKey({
      name: "todo_dependencies_pk",
      columns: [table.successorId, table.predecessorId]
    }),
    foreignKey({
      name: "todo_dependencies_successor_fk",
      columns: [table.successorId],
      foreignColumns: [todosTable.id]
    }),
    foreignKey({
      name: "todo_dependencies_predecessor_fk",
      columns: [table.predecessorId],
      foreignColumns: [todosTable.id]
    }),
    check(
      "todo_dependencies_not_self_check",
      sql`${table.successorId} != ${table.predecessorId}`
    )
  ]
);
