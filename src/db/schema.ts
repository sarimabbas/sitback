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
    }).onDelete("cascade")
  ]
);

export const todosTable = sqliteTable(
  "todos",
  {
    id: int().primaryKey({ autoIncrement: true }),
    description: text().notNull(),
    tagId: int("tag_id"),
    status: text({ enum: todoStatusValues }).notNull().default("todo"),
    inputArtifacts: text("input_artifacts"),
    outputArtifacts: text("output_artifacts"),
    workNotes: text("work_notes"),
    priority: int(),
    dueDate: text("due_date"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
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
    ),
    check(
      "todos_priority_range_check",
      sql`${table.priority} is null or (${table.priority} between 1 and 5)`
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
    }).onDelete("cascade"),
    foreignKey({
      name: "todo_dependencies_predecessor_fk",
      columns: [table.predecessorId],
      foreignColumns: [todosTable.id]
    }).onDelete("cascade"),
    check(
      "todo_dependencies_not_self_check",
      sql`${table.successorId} != ${table.predecessorId}`
    )
  ]
);
