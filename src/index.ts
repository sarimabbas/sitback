import { Command } from "@cliffy/command";
import { createExportCommand } from "@/commands/export/command";
import { createInitCommand } from "@/commands/init/command";
import { createTagCommand } from "@/commands/tags/command";
import { createTodoCommand } from "@/commands/todos/command";
import {
  assertDatabaseInitialized,
  db,
  getDatabaseInitializationWarning,
  initializeDatabase
} from "./db";

await initializeDatabase();

const args = Bun.argv.slice(2);
const commandName = args[0];

const shouldCheckDatabase =
  commandName === "todo" || commandName === "tag" || commandName === "export";
const isHelpRequest =
  args.length === 0 || args.includes("--help") || args.includes("-h") || commandName === "help";

if (shouldCheckDatabase && !isHelpRequest) {
  await assertDatabaseInitialized();
}

const databaseWarning = await getDatabaseInitializationWarning();

const root = new Command()
  .name("sb")
  .version("0.1.0")
  .description("sitback CLI")
  .action(function () {
    return this.showHelp();
  });

if (databaseWarning) {
  root.meta("warning", databaseWarning);
}

root.command("todo", createTodoCommand(db));
root.command("tag", createTagCommand(db));
root.command("export", createExportCommand(db));
root.command("init", createInitCommand());

await root.parse(args);
