import { Command } from "@cliffy/command";
import { claimTodo, getTagById, resolveTagPath } from "@sitback/db/queries";
import type { DbClient } from "@sitback/db/queries";
import { parsePositiveInteger } from "../shared";
import { tagPathType } from "../types";

type ClaimValues = {
  assignee?: string;
  leaseMinutes: number;
  id?: number;
  tag?: string;
  tagId?: number;
};

export async function runClaimCommand(db: DbClient, values: ClaimValues): Promise<string> {
  const assignee = values.assignee?.trim();
  if (!assignee) {
    throw new Error("Invalid --assignee. Provide non-empty text");
  }

  const leaseMinutes = parsePositiveInteger(values.leaseMinutes, "--lease-minutes");
  const id = values.id !== undefined ? parsePositiveInteger(values.id, "--id") : undefined;

  if (values.tag && values.tagId !== undefined) {
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

  const claimed = await claimTodo(db, {
    assignee,
    leaseMinutes,
    id,
    tagId: resolvedTagId
  });

  if (!claimed) {
    if (id !== undefined) {
      throw new Error(`Todo ${id} is not claimable`);
    }

    return "null";
  }

  return Bun.JSON5.stringify(claimed, null, 2) ?? "";
}

export function createTodoClaimCommand(db: DbClient) {
  return new Command()
    .type("tag-path", tagPathType)
    .description("Claim a todo")
    .option("--assignee <value:string>", "Assignee identifier", { required: true })
    .option("--lease-minutes <value:integer>", "Lease length in minutes", {
      default: 15,
      defaultText: "15"
    })
    .option("--id <id:integer>", "Specific todo ID to claim")
    .option("--tag <tag:tag-path>", "Filter by slash tag path")
    .option("--tag-id <value:integer>", "Filter by tag ID")
    .action(async (options) => {
      const output = await runClaimCommand(db, {
        assignee: options.assignee,
        leaseMinutes: options.leaseMinutes,
        id: options.id,
        tag: options.tag,
        tagId: options.tagId
      });
      console.log(output);
    });
}
