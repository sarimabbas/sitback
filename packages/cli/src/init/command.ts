import { Command } from "@cliffy/command";
import { db } from "@sitback/db/bun";
import { runMigrations } from "@sitback/db/lifecycle";

export async function runInitCommand(): Promise<string> {
  await runMigrations(db);
  return "Database initialized.";
}

export function createInitCommand() {
  return new Command().description("Initialize database schema").action(async () => {
    const output = await runInitCommand();
    console.log(output);
  });
}
