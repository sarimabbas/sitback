import { Command } from "@cliffy/command";
import { getTagById, getTodosByIds, getTodosForGet, resolveTagPath } from "@sitback/db/queries";
import type { DbClient } from "@sitback/db/queries";
import { parsePositiveInteger, parsePriority } from "../shared";
import { dateYmdType, tagPathType } from "../types";

type GetValues = {
  ids?: number[];
  num: number;
  numProvided?: boolean;
  blocked?: boolean;
  minPriority?: number;
  dueBefore?: string;
  dueAfter?: string;
  tag?: string;
  tagId?: number;
};

export async function runGetCommand(
  db: DbClient,
  values: GetValues
): Promise<{ output: string; warnings: string[] }> {
  const warnings: string[] = [];
  const idsRaw = values.ids;
  const num = values.num;
  const blocked = values.blocked;
  const minPriorityRaw = values.minPriority;
  const dueBefore = values.dueBefore;
  const dueAfter = values.dueAfter;
  const tagPathRaw = values.tag;
  const tagIdRaw = values.tagId;
  const isNumProvided = values.numProvided ?? false;

  if (tagPathRaw && tagIdRaw !== undefined) {
    throw new Error("Use either --tag or --tag-id, not both");
  }

  let minPriority: number | undefined;
  if (minPriorityRaw !== undefined) {
    minPriority = parsePriority(minPriorityRaw, "--min-priority");
  }

  if (idsRaw !== undefined && isNumProvided) {
    warnings.push("Warning: --num is ignored when --ids is provided");
  }

  if (idsRaw !== undefined && (blocked !== undefined || minPriorityRaw !== undefined || dueBefore || dueAfter)) {
    warnings.push("Warning: --blocked/--min-priority/--due-before/--due-after are ignored when --ids is provided");
  }

  if (idsRaw !== undefined && (tagPathRaw || tagIdRaw !== undefined)) {
    warnings.push("Warning: --tag/--tag-id are ignored when --ids is provided");
  }

  if (idsRaw !== undefined) {
    const parsedIds = idsRaw.map((id) => parsePositiveInteger(id, "--ids"));
    const todos = await getTodosByIds(db, parsedIds);

    return {
      output: Bun.JSON5.stringify(todos, null, 2) ?? "",
      warnings
    };
  }

  const limit = parsePositiveInteger(num, "--num");

  let resolvedTagId: number | undefined;
  if (tagIdRaw !== undefined) {
    const parsedTagId = parsePositiveInteger(tagIdRaw, "--tag-id");
    const tag = await getTagById(db, parsedTagId);
    if (!tag) {
      return {
        output: Bun.JSON5.stringify([], null, 2) ?? "",
        warnings
      };
    }
    resolvedTagId = parsedTagId;
  }

  if (tagPathRaw) {
    const tag = await resolveTagPath(db, tagPathRaw);
    if (!tag) {
      return {
        output: Bun.JSON5.stringify([], null, 2) ?? "",
        warnings
      };
    }
    resolvedTagId = tag.id;
  }

  const todos = await getTodosForGet(db, {
    limit,
    blocked,
    minPriority,
    dueBefore,
    dueAfter,
    tagId: resolvedTagId
  });

  return {
    output: Bun.JSON5.stringify(todos, null, 2) ?? "",
    warnings
  };
}

export function createTodoGetCommand(db: DbClient) {
  return new Command()
    .type("tag-path", tagPathType)
    .type("date-ymd", dateYmdType)
    .description("Get todos")
    .option("--ids <ids:integer[]>", "Comma-separated todo IDs")
    .option("--num <num:integer>", "Number of todos to return", {
      default: 20,
      defaultText: "20"
    })
    .option("--blocked <blocked:boolean>", "Filter by blocked state (true|false)")
    .option("--min-priority <value:integer>", "Minimum priority filter (1-5)")
    .option("--due-before <value:date-ymd>", "Filter by due date upper bound")
    .option("--due-after <value:date-ymd>", "Filter by due date lower bound")
    .option("--tag <tag:tag-path>", "Filter by slash tag path")
    .option("--tag-id <value:integer>", "Filter by tag ID")
    .action(async function (this: { getRawArgs: () => string[] }, options) {
      const rawArgs = this.getRawArgs();
      const numProvided = rawArgs.some((arg) => arg === "--num" || arg.startsWith("--num="));

      const result = await runGetCommand(db, {
        ids: options.ids,
        num: options.num,
        numProvided,
        blocked: options.blocked,
        minPriority: options.minPriority,
        dueBefore: options.dueBefore,
        dueAfter: options.dueAfter,
        tag: options.tag,
        tagId: options.tagId
      });

      for (const warning of result.warnings) {
        console.error(warning);
      }

      console.log(result.output);
    });
}
