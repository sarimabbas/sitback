import { Command } from "@cliffy/command";
import { getAllTagsSummary, getTagSummary } from "@sitback/db/queries";
import type { DbClient } from "@sitback/db/queries";
import { parsePositiveInteger } from "../shared";

type GetTagValues = {
  id?: number;
};

export async function runTagGetCommand(db: DbClient, values: GetTagValues): Promise<string> {
  if (values.id === undefined) {
    const allSummary = await getAllTagsSummary(db);
    return Bun.JSON5.stringify(allSummary, null, 2) ?? "";
  }

  const id = parsePositiveInteger(values.id, "--id");
  const summary = await getTagSummary(db, id);
  if (!summary) {
    throw new Error(`Tag ${id} not found`);
  }

  return Bun.JSON5.stringify(summary, null, 2) ?? "";
}

export function createTagGetCommand(db: DbClient) {
  return new Command()
    .description("Get tags")
    .option("--id <id:integer>", "Tag ID")
    .action(async (options) => {
      const output = await runTagGetCommand(db, {
        id: options.id
      });
      console.log(output);
    });
}
