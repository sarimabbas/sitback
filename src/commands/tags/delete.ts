import { Command } from "@cliffy/command";
import { deleteTag, getTagById } from "@/db";
import type { DbClient } from "@/db";
import { parsePositiveInteger } from "@/commands/shared";

type DeleteTagValues = {
  id?: string;
};

export async function runTagDeleteCommand(db: DbClient, values: DeleteTagValues): Promise<string> {
  const idRaw = values.id?.trim();
  if (!idRaw) {
    throw new Error("Missing required --id option");
  }

  const id = parsePositiveInteger(idRaw, "--id");
  const tag = await getTagById(db, id);
  if (!tag) {
    throw new Error(`Tag ${id} not found`);
  }

  await deleteTag(db, id);

  return (
    Bun.JSON5.stringify(
      {
        deletedId: id,
        deletedName: tag.name
      },
      null,
      2
    ) ?? ""
  );
}

export function createTagDeleteCommand(db: DbClient) {
  return new Command()
    .description("Delete a tag")
    .option("--id <id:string>", "Tag ID")
    .action(async (options) => {
      const output = await runTagDeleteCommand(db, {
        id: options.id
      });
      console.log(output);
    });
}
