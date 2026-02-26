import { Command } from "@cliffy/command";
import { claimTodo } from "@sitback/db/queries";
import type { DbClient } from "@sitback/db/queries";
import { parsePositiveInteger } from "../shared";

type ClaimValues = {
  assignee?: string;
  leaseMinutes: number;
  id?: number;
};

export async function runClaimCommand(db: DbClient, values: ClaimValues): Promise<string> {
  const assignee = values.assignee?.trim();
  if (!assignee) {
    throw new Error("Invalid --assignee. Provide non-empty text");
  }

  const leaseMinutes = parsePositiveInteger(values.leaseMinutes, "--lease-minutes");
  const id = values.id !== undefined ? parsePositiveInteger(values.id, "--id") : undefined;

  const claimed = await claimTodo(db, {
    assignee,
    leaseMinutes,
    id
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
    .description("Claim a todo")
    .option("--assignee <value:string>", "Assignee identifier", { required: true })
    .option("--lease-minutes <value:integer>", "Lease length in minutes", {
      default: 15,
      defaultText: "15"
    })
    .option("--id <id:integer>", "Specific todo ID to claim")
    .action(async (options) => {
      const output = await runClaimCommand(db, {
        assignee: options.assignee,
        leaseMinutes: options.leaseMinutes,
        id: options.id
      });
      console.log(output);
    });
}
