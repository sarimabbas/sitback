import { Command } from "@cliffy/command";
import { ensureTagPath } from "@/db";
import type { DbClient } from "@/db";

type AddTagValues = {
  path?: string;
};

export async function runTagAddCommand(db: DbClient, values: AddTagValues): Promise<string> {
  const path = values.path?.trim();
  if (!path) {
    throw new Error("Missing required --path option");
  }

  const tag = await ensureTagPath(db, path);
  return Bun.JSON5.stringify(tag, null, 2) ?? "";
}

export function createTagAddCommand(db: DbClient) {
  return new Command()
    .description("Add a tag path")
    .option("--path <path:string>", "Slash-separated tag path")
    .action(async (options) => {
      try {
        const output = await runTagAddCommand(db, {
          path: options.path
        });
        console.log(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown tag add error";
        console.error(`Tag add failed: ${message}`);
        process.exit(1);
      }
    });
}
