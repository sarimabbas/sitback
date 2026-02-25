import { Command } from "@cliffy/command";
import { updateTag } from "@sitback/db/queries";
import type { DbClient } from "@sitback/db/queries";
import { parsePositiveInteger } from "../shared";
import { normalizeTagName } from "./shared";

type UpdateTagValues = {
  id: number;
  name: string;
};

export async function runTagUpdateCommand(db: DbClient, values: UpdateTagValues): Promise<string> {
  const id = parsePositiveInteger(values.id, "--id");
  const name = normalizeTagName(values.name.trim());

  const updated = await updateTag(db, id, { name });
  if (!updated) {
    throw new Error(`Tag ${id} not found`);
  }

  return Bun.JSON5.stringify(updated, null, 2) ?? "";
}

export function createTagUpdateCommand(db: DbClient) {
  return new Command()
    .description("Update tag name")
    .option("--id <id:integer>", "Tag ID", { required: true })
    .option("--name <name:string>", "New lowercase alphanumeric name", { required: true })
    .action(async (options) => {
      const output = await runTagUpdateCommand(db, {
        id: options.id,
        name: options.name
      });
      console.log(output);
    });
}
