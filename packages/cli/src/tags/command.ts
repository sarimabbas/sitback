import { Command } from "@cliffy/command";
import type { DbClient } from "@/db";
import { createTagAddCommand } from "./add";
import { createTagDeleteCommand } from "./delete";
import { createTagGetCommand } from "./get";
import { createTagUpdateCommand } from "./update";

export function createTagCommand(db: DbClient) {
  return new Command()
    .description("Manage tags")
    .action(function () {
      return this.showHelp();
    })
    .command("add", createTagAddCommand(db))
    .command("get", createTagGetCommand(db))
    .command("update", createTagUpdateCommand(db))
    .command("delete", createTagDeleteCommand(db));
}
