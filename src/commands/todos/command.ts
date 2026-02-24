import { Command } from "@cliffy/command";
import type { DbClient } from "@/db";
import { createTodoAddCommand } from "./add";
import { createTodoDeleteCommand } from "./delete";
import { createTodoGetCommand } from "./get";
import { createTodoUpdateCommand } from "./update";

export function createTodoCommand(db: DbClient) {
  return new Command()
    .description("Manage todos")
    .command("add", createTodoAddCommand(db))
    .command("get", createTodoGetCommand(db))
    .command("update", createTodoUpdateCommand(db))
    .command("delete", createTodoDeleteCommand(db));
}
