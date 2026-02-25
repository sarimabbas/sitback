import { drizzle } from "drizzle-orm/bun-sqlite";
import { tagsTable, todosTable } from "../schema";

export type DbClient = ReturnType<typeof drizzle>;
export type TodoInsert = typeof todosTable.$inferInsert;
export type TodoUpdate = Partial<
  Pick<
    TodoInsert,
    "description" | "status" | "tagId" | "workNotes" | "priority" | "dueDate"
  >
>;
export type TagInsert = typeof tagsTable.$inferInsert;
export type TagUpdate = Partial<Pick<TagInsert, "name" | "parentId">>;

export type ExportTagNode = {
  id: number;
  name: string;
  parentId: number | null;
  children: ExportTagNode[];
};

export type ExportTodoNode = {
  id: number;
  description: string;
  status: "todo" | "in_progress" | "completed";
  tagId: number | null;
  workNotes: string | null;
  priority: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  isBlocked: boolean;
  predecessorIds: number[];
  children: ExportTodoNode[];
};
