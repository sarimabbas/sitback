import { Command } from "@cliffy/command";
import { createExportCommand } from "@/commands/export/command";
import { createTagCommand } from "@/commands/tags/command";
import { createTodoCommand } from "@/commands/todos/command";
import { db, initializeDatabase } from "./db";

await initializeDatabase();

const args = Bun.argv.slice(2);

const root = new Command()
  .name("sb")
  .version("0.1.0")
  .description("sitback CLI")
  .throwErrors()
  .noExit();

root.command("todo", createTodoCommand(db));
root.command("tag", createTagCommand(db));
root.command("export", createExportCommand(db));

const parseArgs = args.length === 0 || args[0] === "help" ? ["--help"] : args;

try {
  await root.parse(parseArgs);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown CLI parse error";
  console.error(message);
  process.exit(1);
}
