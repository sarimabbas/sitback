import { Command } from "@cliffy/command";
import { deleteTag, getTagById } from "@sitback/db/queries";
import type { DbClient } from "@sitback/db/queries";
import { parsePositiveInteger } from "../shared";

type DeleteTagValues = {
  id: number;
};

export async function runTagDeleteCommand(db: DbClient, values: DeleteTagValues): Promise<string> {
  const id = parsePositiveInteger(values.id, "--id");
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
    .option("--id <id:integer>", "Tag ID", { required: true })
    .action(async (options) => {
      const output = await runTagDeleteCommand(db, {
        id: options.id
      });
      console.log(output);
    });
}
