import { Command } from "@cliffy/command";
import { ensureTagPath } from "@/db";
import type { DbClient } from "@/db";
import { tagPathType } from "@/commands/types";

type AddTagValues = {
  path: string;
};

export async function runTagAddCommand(db: DbClient, values: AddTagValues): Promise<string> {
  const tag = await ensureTagPath(db, values.path);
  return Bun.JSON5.stringify(tag, null, 2) ?? "";
}

export function createTagAddCommand(db: DbClient) {
  return new Command()
    .type("tag-path", tagPathType)
    .description("Add a tag path")
    .option("--path <path:tag-path>", "Slash-separated tag path", { required: true })
    .action(async (options) => {
      const output = await runTagAddCommand(db, {
        path: options.path
      });
      console.log(output);
    });
}
