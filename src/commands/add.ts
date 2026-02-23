import { addTodo } from "@/db";
import type { DbClient } from "@/db";
import { parseDateString, parseIdsList, parsePriority } from "./shared";

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

  const status = values.status ?? "todo";
  if (status !== "todo" && status !== "in_progress" && status !== "completed") {
    throw new Error("Invalid --status. Use todo, in_progress, or completed");
  }

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
    status: status,
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
