import { Command } from "@cliffy/command";
import type { DbClient } from "@sitback/db/queries";
import { createTodoAddCommand } from "./add";
import { createTodoClaimCommand } from "./claim";
import { createTodoDeleteCommand } from "./delete";
import { createTodoGetCommand } from "./get";
import { createTodoUpdateCommand } from "./update";

export function createTodoCommand(db: DbClient) {
  return new Command()
    .description("Manage todos")
    .action(function () {
      return this.showHelp();
    })
    .command("add", createTodoAddCommand(db))
    .command("claim", createTodoClaimCommand(db))
    .command("get", createTodoGetCommand(db))
    .command("update", createTodoUpdateCommand(db))
    .command("delete", createTodoDeleteCommand(db));
}
