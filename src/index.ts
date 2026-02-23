import { parseArgs } from "util";
import { db, initializeDatabase } from "./db";
import { runAddCommand } from "./commands/add";
import { runDeleteCommand } from "./commands/delete";
import { runExportCommand } from "./commands/export";
import { runGetCommand } from "./commands/get";
import { runTagCommand } from "./commands/tag";
import { runUpdateCommand } from "./commands/update";

await initializeDatabase();

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`sitback v${VERSION}

Usage:
  sb help
  sb todo add --description <text> [--tag path/to/tag] [--status todo|in_progress|completed] [--predecessors 1,2] [--priority 1-5] [--due-date YYYY-MM-DD]
  sb todo update --id 7 [--description <text>] [--status todo|in_progress|completed] [--tag path/to/tag|--tag-id 2] [--predecessors 1,2]
  sb todo delete --ids 1,2
  sb todo get [--ids 1,2] [--num 3] [--blocked true|false] [--min-priority 3] [--due-before YYYY-MM-DD] [--due-after YYYY-MM-DD] [--tag path/to/tag] [--tag-id 2]
  sb tag add --path parent/child
  sb tag get [--id 12]
  sb tag update --id 12 --name newname
  sb tag delete --id 12
  sb export [--format json5|markdown]
  sb --help
  sb -h

Commands:
  help      Show this help output
  todo      Manage todos (add, get, update, delete)
  tag       Manage tags (add, get, update, delete)
  export    Export tag and todo trees

Global options:
  -h, --help     Show help

Examples:
  sb help
  sb todo add --description "map results" --tag "work/backend" --status todo
  sb todo update --id 7 --status completed --predecessors 1,2
  sb todo add --description "summarize run" --input-artifacts "logs/run-42.txt" --output-artifacts "reports/summary.md"
  sb todo delete --ids 3,5,8
  sb todo add --description "reduce results" --predecessors 1,2
  sb todo get
  # no options -> best next actionable todo (unblocked + status=todo, limit 1)
  sb todo get --num 3
  sb todo get --ids 4,8,15
  sb todo get --blocked true --min-priority 4
  sb todo get --due-before 2030-12-31
  sb todo get --tag work/backend
  sb todo get --tag-id 2
  sb tag add --path work/backend
  sb tag get
  sb tag get --id 2
  sb tag update --id 2 --name services
  sb tag delete --id 2
  sb export
  sb export --format json5
  sb export --format markdown
  sb --help`);
}

const args = Bun.argv.slice(2);

const parsed = parseArgs({
  args,
  options: {
    help: { type: "boolean", short: "h" },
    format: { type: "string" },
    description: { type: "string" },
    tag: { type: "string" },
    status: { type: "string" },
    predecessors: { type: "string" },
    "input-artifacts": { type: "string" },
    "output-artifacts": { type: "string" },
    "work-notes": { type: "string" },
    priority: { type: "string" },
    "due-date": { type: "string" },
    path: { type: "string" },
    id: { type: "string" },
    name: { type: "string" },
    "tag-id": { type: "string" },
    ids: { type: "string" },
    num: { type: "string" },
    blocked: { type: "string" },
    "min-priority": { type: "string" },
    "due-before": { type: "string" },
    "due-after": { type: "string" },
  },
  strict: true,
  allowPositionals: true,
});

const { values, positionals } = parsed;
const command = positionals[0];
const todoSubcommand = positionals[1];
const tagSubcommand = positionals[1];

if (values.help || !command) {
  printHelp();
  process.exit(0);
}

if (command === "help") {
  printHelp();
  process.exit(0);
}

if (command === "todo") {
  if (todoSubcommand === "add") {
    try {
      const output = await runAddCommand(db, {
        description: values.description,
        tag: values.tag,
        status: values.status,
        predecessors: values.predecessors,
        inputArtifacts: values["input-artifacts"],
        outputArtifacts: values["output-artifacts"],
        workNotes: values["work-notes"],
        priority: values.priority,
        dueDate: values["due-date"],
      });
      console.log(output);
      process.exit(0);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown todo add command error";
      console.error(`Todo add failed: ${message}`);
      process.exit(1);
    }
  }

  if (todoSubcommand === "delete") {
    try {
      const output = await runDeleteCommand(db, {
        ids: values.ids,
      });
      console.log(output);
      process.exit(0);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown todo delete command error";
      console.error(`Todo delete failed: ${message}`);
      process.exit(1);
    }
  }

  if (todoSubcommand === "update") {
    try {
      const output = await runUpdateCommand(db, {
        id: values.id,
        description: values.description,
        status: values.status,
        predecessors: values.predecessors,
        tag: values.tag,
        tagId: values["tag-id"],
        inputArtifacts: values["input-artifacts"],
        outputArtifacts: values["output-artifacts"],
        workNotes: values["work-notes"],
        priority: values.priority,
        dueDate: values["due-date"],
      });
      console.log(output);
      process.exit(0);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown todo update command error";
      console.error(`Todo update failed: ${message}`);
      process.exit(1);
    }
  }

  if (todoSubcommand === "get") {
    try {
      const result = await runGetCommand(db, {
        ids: values.ids,
        num: values.num,
        blocked: values.blocked,
        minPriority: values["min-priority"],
        dueBefore: values["due-before"],
        dueAfter: values["due-after"],
        tag: values.tag,
        tagId: values["tag-id"],
      });
      for (const warning of result.warnings) {
        console.error(warning);
      }
      console.log(result.output);
      process.exit(0);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown todo get command error";
      console.error(`Todo get failed: ${message}`);
      process.exit(1);
    }
  }

  console.error(`Unknown todo subcommand: ${todoSubcommand ?? "(missing)"}`);
  printHelp();
  process.exit(1);
}

if (command === "export") {
  try {
    const output = await runExportCommand(db, { format: values.format });
    console.log(output);
    process.exit(0);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown export command error";
    console.error(`Export failed: ${message}`);
    console.error(
      "Run `bun run db:migrate` first to initialize the database schema.",
    );
    process.exit(1);
  }
}

if (command === "tag") {
  try {
    const output = await runTagCommand(db, tagSubcommand, {
      path: values.path,
      id: values.id,
      name: values.name,
    });
    console.log(output);
    process.exit(0);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown tag command error";
    console.error(`Tag failed: ${message}`);
    process.exit(1);
  }
}

console.error(`Unknown command: ${command}`);
printHelp();
process.exit(1);
