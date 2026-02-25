import { Command } from "@cliffy/command";
import { deleteTodo } from "@sitback/db/queries";
import type { DbClient } from "@sitback/db/queries";
import { parsePositiveInteger } from "../shared";

type DeleteValues = {
  ids: number[];
};

export async function runDeleteCommand(db: DbClient, values: DeleteValues): Promise<string> {
  const ids = values.ids.map((id) => parsePositiveInteger(id, "--ids"));
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
    .option("--ids <ids:integer[]>", "Comma-separated todo IDs", { required: true })
    .action(async (options) => {
      const output = await runDeleteCommand(db, {
        ids: options.ids
      });
      console.log(output);
    });
}
