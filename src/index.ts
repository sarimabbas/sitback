import { parseArgs } from "util";
import { db, initializeDatabase } from "./db";
import { runAddCommand } from "./commands/add";
import { runDeleteCommand } from "./commands/delete";
import { runExportCommand } from "./commands/export";
import { runGetCommand } from "./commands/get";

await initializeDatabase();

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`sitback v${VERSION}

Usage:
  sb help
  sb add --description <text> [--tag path/to/tag] [--status todo|in_progress|completed] [--predecessors 1,2] [--priority 1-5] [--due-date YYYY-MM-DD]
  sb delete --ids 1,2
  sb get [--ids 1,2] [--num 3] [--blocked true|false] [--min-priority 3] [--due-before YYYY-MM-DD] [--due-after YYYY-MM-DD]
  sb export [--format json5|markdown]
  sb --help
  sb -h

Commands:
  help      Show this help output
  add       Add a todo
  delete    Delete one or more todos by ID
  get       Get todos; defaults to best next actionable todo
  export    Export tag and todo trees

Global options:
  -h, --help     Show help

Examples:
  sb help
  sb add --description "map results" --tag "work/backend" --status todo
  sb add --description "summarize run" --input-artifacts "logs/run-42.txt" --output-artifacts "reports/summary.md"
  sb delete --ids 3,5,8
  sb add --description "reduce results" --predecessors 1,2
  sb get
  # no options -> best next actionable todo (unblocked + status=todo, limit 1)
  sb get --num 3
  sb get --ids 4,8,15
  sb get --blocked true --min-priority 4
  sb get --due-before 2030-12-31
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
    ids: { type: "string" },
    num: { type: "string" },
    blocked: { type: "string" },
    "min-priority": { type: "string" },
    "due-before": { type: "string" },
    "due-after": { type: "string" }
  },
  strict: true,
  allowPositionals: true
});

const { values, positionals } = parsed;
const command = positionals[0];

if (values.help || !command) {
  printHelp();
  process.exit(0);
}

if (command === "help") {
  printHelp();
  process.exit(0);
}

if (command === "add") {
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
      dueDate: values["due-date"]
    });
    console.log(output);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown add command error";
    console.error(`Add failed: ${message}`);
    process.exit(1);
  }
}

if (command === "delete") {
  try {
    const output = await runDeleteCommand(db, {
      ids: values.ids
    });
    console.log(output);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown delete command error";
    console.error(`Delete failed: ${message}`);
    process.exit(1);
  }
}

if (command === "get") {
  try {
    const result = await runGetCommand(db, {
      ids: values.ids,
      num: values.num,
      blocked: values.blocked,
      minPriority: values["min-priority"],
      dueBefore: values["due-before"],
      dueAfter: values["due-after"]
    });
    for (const warning of result.warnings) {
      console.error(warning);
    }
    console.log(result.output);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown get command error";
    console.error(`Get failed: ${message}`);
    process.exit(1);
  }
}

if (command === "export") {
  try {
    const output = await runExportCommand(db, { format: values.format });
    console.log(output);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown export command error";
    console.error(`Export failed: ${message}`);
    console.error("Run `bun run db:migrate` first to initialize the database schema.");
    process.exit(1);
  }
}

console.error(`Unknown command: ${command}`);
printHelp();
process.exit(1);
