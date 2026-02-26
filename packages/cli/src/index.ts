import { Command } from "@cliffy/command";
import { createExportCommand } from "@/export/command";
import { createInitCommand } from "@/init/command";
import { createTagCommand } from "@/tags/command";
import { createTodoCommand } from "@/todos/command";
import { createWebCommand } from "@/web/command";
import { db } from "@sitback/db/bun";
import {
  assertDatabaseInitialized,
  getDatabaseInitializationWarning,
  initializeDatabase
} from "@sitback/db/lifecycle";

await initializeDatabase(db);

const args = Bun.argv.slice(2);
const commandName = args[0];

const shouldCheckDatabase =
  commandName === "todo" || commandName === "tag" || commandName === "export" || commandName === "web";
const isHelpRequest =
  args.length === 0 || args.includes("--help") || args.includes("-h") || commandName === "help";

if (shouldCheckDatabase && !isHelpRequest) {
  await assertDatabaseInitialized(db);
}

const databaseWarning = await getDatabaseInitializationWarning(db);

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
root.command("web", createWebCommand());

await root.parse(args);
