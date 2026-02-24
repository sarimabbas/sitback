import { Command } from "@cliffy/command";
import { runMigrations } from "@/db";

export async function runInitCommand(): Promise<string> {
  await runMigrations();
  return "Database initialized.";
}

export function createInitCommand() {
  return new Command().description("Initialize database schema").action(async () => {
    const output = await runInitCommand();
    console.log(output);
  });
}
