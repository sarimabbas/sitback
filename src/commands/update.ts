import { getTagById, resolveTagPath, updateTodoWithRelations } from "@/db";
import type { DbClient } from "@/db";
import {
  parseDateString,
  parseIdsList,
  parsePositiveInteger,
  parsePriority,
  parseTodoStatus
} from "./shared";

type UpdateValues = {
  id?: string;
  description?: string;
  status?: string;
  predecessors?: string;
  tag?: string;
  tagId?: string;
  inputArtifacts?: string;
  outputArtifacts?: string;
  workNotes?: string;
  priority?: string;
  dueDate?: string;
};

export async function runUpdateCommand(db: DbClient, values: UpdateValues): Promise<string> {
  const idRaw = values.id?.trim();
  if (!idRaw) {
    throw new Error("Missing required --id option");
  }

  const id = parsePositiveInteger(idRaw, "--id");

  if (values.tag && values.tagId) {
    throw new Error("Use either --tag or --tag-id, not both");
  }

  let resolvedTagId: number | undefined;
  if (values.tagId !== undefined) {
    const raw = values.tagId.trim();
    if (raw.length === 0) {
      throw new Error("Invalid --tag-id. Use a positive integer");
    }
    const parsedTagId = parsePositiveInteger(raw, "--tag-id");
    const tag = await getTagById(db, parsedTagId);
    if (!tag) {
      throw new Error(`Tag ${parsedTagId} not found`);
    }
    resolvedTagId = parsedTagId;
  }

  if (values.tag !== undefined) {
    const rawPath = values.tag.trim();
    if (rawPath.length === 0) {
      throw new Error("Invalid --tag. Use a slash-separated path");
    }
    const tag = await resolveTagPath(db, rawPath);
    if (!tag) {
      throw new Error(`Tag path not found: ${rawPath}`);
    }
    resolvedTagId = tag.id;
  }

  let parsedPriority: number | undefined;
  if (values.priority !== undefined) {
    const raw = values.priority.trim();
    if (raw.length === 0) {
      throw new Error("Invalid --priority. Use an integer from 1 to 5");
    }
    parsedPriority = parsePriority(raw, "--priority");
  }

  let parsedDueDate: string | undefined;
  if (values.dueDate !== undefined) {
    const raw = values.dueDate.trim();
    if (raw.length === 0) {
      throw new Error("Invalid --due-date. Use YYYY-MM-DD");
    }
    parsedDueDate = parseDateString(raw, "--due-date");
  }

  let predecessorIds: number[] | undefined;
  if (values.predecessors !== undefined) {
    const raw = values.predecessors.trim();
    predecessorIds = raw.length === 0 ? [] : parseIdsList(raw, "--predecessors");
  }

  const changes: {
    description?: string;
    status?: "todo" | "in_progress" | "completed";
    tagId?: number;
    inputArtifacts?: string;
    outputArtifacts?: string;
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
    changes.status = parseTodoStatus(values.status, "--status");
  }

  if (resolvedTagId !== undefined) {
    changes.tagId = resolvedTagId;
  }

  if (values.inputArtifacts !== undefined) {
    changes.inputArtifacts = values.inputArtifacts.trim();
  }

  if (values.outputArtifacts !== undefined) {
    changes.outputArtifacts = values.outputArtifacts.trim();
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
