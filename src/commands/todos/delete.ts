import { Command } from "@cliffy/command";
import { deleteTodo } from "@/db";
import type { DbClient } from "@/db";
import { parseIdsList } from "@/commands/shared";

type DeleteValues = {
  ids?: string;
};

export async function runDeleteCommand(db: DbClient, values: DeleteValues): Promise<string> {
  const idsRaw = values.ids?.trim();

  if (!idsRaw) {
    throw new Error("Missing required --ids option");
  }

  const ids = parseIdsList(idsRaw, "--ids");
  const deletedIds: number[] = [];

  for (const id of ids) {
    const deleted = await deleteTodo(db, id);
    if (deleted) {
      deletedIds.push(deleted.id);
    }
  }

  return (
    Bun.JSON5.stringify(
      {
        requestedIds: ids,
        deletedIds,
        deletedCount: deletedIds.length
      },
      null,
      2
    ) ?? ""
  );
}

export function createTodoDeleteCommand(db: DbClient) {
  return new Command()
    .description("Delete todos")
    .option("--ids <ids:string>", "Comma-separated todo IDs")
    .action(async (options) => {
      const output = await runDeleteCommand(db, {
        ids: options.ids
      });
      console.log(output);
    });
}
