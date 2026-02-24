import { Command } from "@cliffy/command";
import { addTodo } from "@/db";
import type { DbClient } from "@/db";
import { parseDateString, parseIdsList, parsePriority, parseTodoStatus } from "@/commands/shared";

type AddValues = {
  description?: string;
  tag?: string;
  status?: string;
  predecessors?: string;
  priority?: string;
  dueDate?: string;
  inputArtifacts?: string;
  outputArtifacts?: string;
  workNotes?: string;
};

export async function runAddCommand(db: DbClient, values: AddValues): Promise<string> {
  const description = values.description?.trim();

  if (!description) {
    throw new Error("Missing required --description option");
  }

  const status = parseTodoStatus(values.status ?? "todo", "--status");

  let predecessorIds: number[] = [];
  if (values.predecessors && values.predecessors.trim().length > 0) {
    predecessorIds = parseIdsList(values.predecessors, "--predecessors");
  }

  let priority: number | undefined;
  if (values.priority && values.priority.trim().length > 0) {
    priority = parsePriority(values.priority, "--priority");
  }

  let dueDate: string | undefined;
  if (values.dueDate && values.dueDate.trim().length > 0) {
    dueDate = parseDateString(values.dueDate, "--due-date");
  }

  const added = await addTodo(db, {
    description,
    tagPath: values.tag,
    status,
    predecessorIds,
    inputArtifacts: values.inputArtifacts?.trim() || undefined,
    outputArtifacts: values.outputArtifacts?.trim() || undefined,
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
    .description("Add a todo")
    .option("--description <description:string>", "Todo description")
    .option("--tag <tag:string>", "Slash-separated tag path")
    .option("--status <status:string>", "todo | in_progress | completed")
    .option("--predecessors <predecessors:string>", "Comma-separated predecessor IDs")
    .option("--input-artifacts <value:string>", "Input artifacts")
    .option("--output-artifacts <value:string>", "Output artifacts")
    .option("--work-notes <value:string>", "Work notes")
    .option("--priority <priority:string>", "Priority 1-5")
    .option("--due-date <value:string>", "Due date YYYY-MM-DD")
    .action(async (options) => {
      const output = await runAddCommand(db, {
        description: options.description,
        tag: options.tag,
        status: options.status,
        predecessors: options.predecessors,
        inputArtifacts: options.inputArtifacts,
        outputArtifacts: options.outputArtifacts,
        workNotes: options.workNotes,
        priority: options.priority,
        dueDate: options.dueDate
      });
      console.log(output);
    });
}
