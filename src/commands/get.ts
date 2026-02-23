import { getTodosByIds, getTodosForGet } from "@/db";
import type { DbClient } from "@/db";
import { parseBooleanString, parseDateString, parseIdsList, parsePositiveInteger, parsePriority } from "./shared";

type GetValues = {
  ids?: string;
  num?: string;
  blocked?: string;
  minPriority?: string;
  dueBefore?: string;
  dueAfter?: string;
};

export async function runGetCommand(
  db: DbClient,
  values: GetValues
): Promise<{ output: string; warnings: string[] }> {
  const warnings: string[] = [];
  const idsRaw = values.ids?.trim();
  const numRaw = values.num?.trim();
  const blockedRaw = values.blocked?.trim();
  const minPriorityRaw = values.minPriority?.trim();
  const dueBefore = values.dueBefore?.trim();
  const dueAfter = values.dueAfter?.trim();

  let blocked: boolean | undefined;
  if (blockedRaw !== undefined) {
    blocked = parseBooleanString(blockedRaw, "--blocked");
  }

  let minPriority: number | undefined;
  if (minPriorityRaw) {
    minPriority = parsePriority(minPriorityRaw, "--min-priority");
  }

  if (dueBefore) {
    parseDateString(dueBefore, "--due-before");
  }

  if (dueAfter) {
    parseDateString(dueAfter, "--due-after");
  }

  if (idsRaw && numRaw) {
    warnings.push("Warning: --num is ignored when --ids is provided");
  }

  if (idsRaw && (blockedRaw !== undefined || minPriorityRaw || dueBefore || dueAfter)) {
    warnings.push("Warning: --blocked/--min-priority/--due-before/--due-after are ignored when --ids is provided");
  }

  if (idsRaw) {
    const parsedIds = parseIdsList(idsRaw, "--ids");
    const todos = await getTodosByIds(db, parsedIds);

    return {
      output: Bun.JSON5.stringify(todos, null, 2) ?? "",
      warnings
    };
  }

  let limit = 1;
  if (numRaw) {
    limit = parsePositiveInteger(numRaw, "--num");
  }

  const todos = await getTodosForGet(db, {
    limit,
    actionableOnly: blocked === undefined,
    blocked,
    minPriority,
    dueBefore,
    dueAfter
  });

  return {
    output: Bun.JSON5.stringify(todos, null, 2) ?? "",
    warnings
  };
}
