import { Command, EnumType } from "@cliffy/command";
import { addTodo } from "@/db";
import type { DbClient } from "@/db";
import { parsePositiveInteger, parsePriority } from "@/commands/shared";
import { dateYmdType, tagPathType } from "@/commands/types";

type TodoStatus = "todo" | "in_progress" | "completed";

type AddValues = {
  description?: string;
  tag?: string;
  status: TodoStatus;
  predecessors?: number[];
  priority?: number;
  dueDate?: string;
  workNotes?: string;
};

const todoStatusType = new EnumType(["todo", "in_progress", "completed"] as const);

export async function runAddCommand(db: DbClient, values: AddValues): Promise<string> {
  const description = values.description?.trim();

  if (!description) {
    throw new Error("Invalid --description. Provide non-empty text");
  }

  const status = values.status;

  let predecessorIds: number[] = [];
  if (values.predecessors !== undefined) {
    predecessorIds = values.predecessors.map((id) => parsePositiveInteger(id, "--predecessors"));
  }

  let priority: number | undefined;
  if (values.priority !== undefined) {
    priority = parsePriority(values.priority, "--priority");
  }

  let dueDate: string | undefined;
  if (values.dueDate !== undefined) {
    dueDate = values.dueDate;
  }

  const added = await addTodo(db, {
    description,
    tagPath: values.tag,
    status,
    predecessorIds,
    workNotes: values.workNotes?.trim() || undefined,
    priority,
    dueDate
  });

  if (!added) {
    throw new Error("Failed to create todo");
  }

  return Bun.JSON5.stringify(added, null, 2) ?? "";
}

export function createTodoAddCommand(db: DbClient) {
  return new Command()
    .type("todo-status", todoStatusType)
    .type("tag-path", tagPathType)
    .type("date-ymd", dateYmdType)
    .description("Add a todo")
    .option("--description <description:string>", "Todo description", { required: true })
    .option("--tag <tag:tag-path>", "Slash-separated tag path")
    .option("--status <status:todo-status>", "Todo status", {
      default: "todo",
      defaultText: "todo"
    })
    .option("--predecessors <predecessors:integer[]>", "Comma-separated predecessor IDs")
    .option("--work-notes <value:string>", "Work notes")
    .option("--priority <priority:integer>", "Priority 1-5")
    .option("--due-date <value:date-ymd>", "Due date YYYY-MM-DD")
    .action(async (options) => {
      const output = await runAddCommand(db, {
        description: options.description,
        tag: options.tag,
        status: options.status,
        predecessors: options.predecessors,
        workNotes: options.workNotes,
        priority: options.priority,
        dueDate: options.dueDate
      });
      console.log(output);
    });
}
