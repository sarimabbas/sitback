import { Command } from "@cliffy/command";
import { updateTag } from "@/db";
import type { DbClient } from "@/db";
import { parsePositiveInteger } from "@/commands/shared";
import { normalizeTagName } from "./shared";

type UpdateTagValues = {
  id?: string;
  name?: string;
};

export async function runTagUpdateCommand(db: DbClient, values: UpdateTagValues): Promise<string> {
  const idRaw = values.id?.trim();
  const nameRaw = values.name?.trim();

  if (!idRaw) {
    throw new Error("Missing required --id option");
  }

  if (!nameRaw) {
    throw new Error("Missing required --name option");
  }

  const id = parsePositiveInteger(idRaw, "--id");
  const name = normalizeTagName(nameRaw);

  const updated = await updateTag(db, id, { name });
  if (!updated) {
    throw new Error(`Tag ${id} not found`);
  }

  return Bun.JSON5.stringify(updated, null, 2) ?? "";
}

export function createTagUpdateCommand(db: DbClient) {
  return new Command()
    .description("Update tag name")
    .option("--id <id:string>", "Tag ID")
    .option("--name <name:string>", "New lowercase alphanumeric name")
    .action(async (options) => {
      try {
        const output = await runTagUpdateCommand(db, {
          id: options.id,
          name: options.name
        });
        console.log(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown tag update error";
        console.error(`Tag update failed: ${message}`);
        process.exit(1);
      }
    });
}
