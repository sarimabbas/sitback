import { Command, EnumType } from "@cliffy/command";
import { getTagById, resolveTagPath, updateTodoWithRelations } from "@sitback/db";
import type { DbClient } from "@sitback/db";
import { parsePositiveInteger, parsePriority } from "../shared";
import { dateYmdType, tagPathType } from "../types";

type TodoStatus = "todo" | "in_progress" | "completed";

type UpdateValues = {
  id: number;
  description?: string;
  status?: TodoStatus;
  predecessors?: number[];
  clearPredecessors?: boolean;
  tag?: string;
  tagId?: number;
  workNotes?: string;
  priority?: number;
  dueDate?: string;
};

const todoStatusType = new EnumType(["todo", "in_progress", "completed"] as const);

export async function runUpdateCommand(db: DbClient, values: UpdateValues): Promise<string> {
  const id = parsePositiveInteger(values.id, "--id");

  if (values.tag && values.tagId) {
    throw new Error("Use either --tag or --tag-id, not both");
  }

  let resolvedTagId: number | undefined;
  if (values.tagId !== undefined) {
    const parsedTagId = parsePositiveInteger(values.tagId, "--tag-id");
    const tag = await getTagById(db, parsedTagId);
    if (!tag) {
      throw new Error(`Tag ${parsedTagId} not found`);
    }
    resolvedTagId = parsedTagId;
  }

  if (values.tag !== undefined) {
    const tag = await resolveTagPath(db, values.tag);
    if (!tag) {
      throw new Error(`Tag path not found: ${values.tag}`);
    }
    resolvedTagId = tag.id;
  }

  let parsedPriority: number | undefined;
  if (values.priority !== undefined) {
    parsedPriority = parsePriority(values.priority, "--priority");
  }

  let parsedDueDate: string | undefined;
  if (values.dueDate !== undefined) {
    parsedDueDate = values.dueDate;
  }

  let predecessorIds: number[] | undefined;
  if (values.clearPredecessors) {
    predecessorIds = [];
  } else if (values.predecessors !== undefined) {
    predecessorIds = values.predecessors.map((id) => parsePositiveInteger(id, "--predecessors"));
  }

  const changes: {
    description?: string;
    status?: "todo" | "in_progress" | "completed";
    tagId?: number;
    workNotes?: string;
    priority?: number;
    dueDate?: string;
  } = {};

  if (values.description !== undefined) {
    const description = values.description.trim();
    if (description.length === 0) {
      throw new Error("Invalid --description. Provide non-empty text");
    }
    changes.description = description;
  }

  if (values.status !== undefined) {
    changes.status = values.status;
  }

  if (resolvedTagId !== undefined) {
    changes.tagId = resolvedTagId;
  }

  if (values.workNotes !== undefined) {
    changes.workNotes = values.workNotes.trim();
  }

  if (parsedPriority !== undefined) {
    changes.priority = parsedPriority;
  }

  if (parsedDueDate !== undefined) {
    changes.dueDate = parsedDueDate;
  }

  if (Object.keys(changes).length === 0 && predecessorIds === undefined) {
    throw new Error("No updates provided");
  }

  const updated = await updateTodoWithRelations(db, {
    id,
    changes,
    predecessorIds
  });

  if (!updated) {
    throw new Error(`Todo ${id} not found`);
  }

  return Bun.JSON5.stringify(updated, null, 2) ?? "";
}

export function createTodoUpdateCommand(db: DbClient) {
  return new Command()
    .type("todo-status", todoStatusType)
    .type("tag-path", tagPathType)
    .type("date-ymd", dateYmdType)
    .description("Update a todo")
    .option("--id <id:integer>", "Todo ID", { required: true })
    .option("--description <description:string>", "Todo description")
    .option("--status <status:todo-status>", "Todo status")
    .option("--predecessors <predecessors:integer[]>", "Comma-separated predecessor IDs")
    .option("--clear-predecessors", "Clear predecessor IDs (takes precedence over --predecessors)")
    .option("--tag <tag:tag-path>", "Slash-separated tag path")
    .option("--tag-id <value:integer>", "Tag ID")
    .option("--work-notes <value:string>", "Work notes")
    .option("--priority <priority:integer>", "Priority 1-5")
    .option("--due-date <value:date-ymd>", "Due date YYYY-MM-DD")
    .action(async (options) => {
      const output = await runUpdateCommand(db, {
        id: options.id,
        description: options.description,
        status: options.status,
        predecessors: options.predecessors,
        clearPredecessors: options.clearPredecessors,
        tag: options.tag,
        tagId: options.tagId,
        workNotes: options.workNotes,
        priority: options.priority,
        dueDate: options.dueDate
      });
      console.log(output);
    });
}
