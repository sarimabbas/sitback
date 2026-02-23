import { parseArgs } from "util";
import { addTodo, db, getExportTree, getNextTodos, getTodosByIds, initializeDatabase } from "./db";
import type { ExportTagNode, ExportTodoNode } from "./db";

await initializeDatabase();

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`sitback v${VERSION}

Usage:
  sb help
  sb add --description <text> [--tag path/to/tag] [--status todo|in_progress|completed] [--predecessors 1,2]
  sb get [--ids 1,2] [--num 3]
  sb export [--format json5|markdown]
  sb --help
  sb -h

Commands:
  help      Show this help output
  add       Add a todo
  get       Get todos; defaults to best next actionable todo
  export    Export tag and todo trees

Global options:
  -h, --help     Show help

Examples:
  sb help
  sb add --description "map results" --tag "work/backend" --status todo
  sb add --description "reduce results" --predecessors 1,2
  sb get
  # no options -> best next actionable todo (unblocked + status=todo, limit 1)
  sb get --num 3
  sb get --ids 4,8,15
  sb export
  sb export --format json5
  sb export --format markdown
  sb --help`);
}

function renderTagMarkdown(nodes: ExportTagNode[], depth = 0): string {
  const prefix = "  ".repeat(depth);

  return nodes
    .map((node) => {
      const line = `${prefix}- ${node.name} (#${node.id})`;
      if (node.children.length === 0) {
        return line;
      }
      return `${line}\n${renderTagMarkdown(node.children, depth + 1)}`;
    })
    .join("\n");
}

function renderTodoMarkdown(nodes: ExportTodoNode[], depth = 0): string {
  const prefix = "  ".repeat(depth);

  return nodes
    .map((node) => {
      const predecessors =
        node.predecessorIds.length > 0 ? node.predecessorIds.map((id) => `#${id}`).join(",") : "none";
      const line = `${prefix}- #${node.id} ${node.description} [status=${node.status}, blocked=${node.isBlocked}, tag=${node.tagId ?? "none"}, predecessors=${predecessors}]`;

      if (node.children.length === 0) {
        return line;
      }

      return `${line}\n${renderTodoMarkdown(node.children, depth + 1)}`;
    })
    .join("\n");
}

function toMarkdown(payload: { tagTree: ExportTagNode[]; todoTree: ExportTodoNode[] }): string {
  const tags = payload.tagTree.length > 0 ? renderTagMarkdown(payload.tagTree) : "- (none)";
  const todos = payload.todoTree.length > 0 ? renderTodoMarkdown(payload.todoTree) : "- (none)";

  return `# sitback export\n\n## tag_tree\n${tags}\n\n## todo_tree\n${todos}`;
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
    ids: { type: "string" },
    num: { type: "string" }
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
  const description = values.description?.trim();

  if (!description) {
    console.error("Missing required --description option");
    process.exit(1);
  }

  const status = values.status ?? "todo";
  if (status !== "todo" && status !== "in_progress" && status !== "completed") {
    console.error("Invalid --status. Use todo, in_progress, or completed");
    process.exit(1);
  }

  let predecessorIds: number[] = [];
  if (values.predecessors && values.predecessors.trim().length > 0) {
    const parsedIds = values.predecessors.split(",").map((raw) => Number.parseInt(raw.trim(), 10));
    if (parsedIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      console.error("Invalid --predecessors. Use a comma-separated list of positive integer IDs");
      process.exit(1);
    }
    predecessorIds = parsedIds;
  }

  try {
    const added = await addTodo(db, {
      description,
      tagPath: values.tag,
      status,
      predecessorIds
    });

    if (!added) {
      console.error("Failed to create todo");
      process.exit(1);
    }

    console.log(Bun.JSON5.stringify(added, null, 2));
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown add error";
    console.error(`Add failed: ${message}`);
    process.exit(1);
  }
}

if (command === "get") {
  const idsRaw = values.ids?.trim();
  const numRaw = values.num?.trim();

  if (idsRaw && numRaw) {
    console.error("Warning: --num is ignored when --ids is provided");
  }

  if (idsRaw) {
    const parsedIds = idsRaw.split(",").map((raw) => Number.parseInt(raw.trim(), 10));
    if (parsedIds.length === 0 || parsedIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      console.error("Invalid --ids. Use a comma-separated list of positive integer IDs");
      process.exit(1);
    }

    try {
      const todos = await getTodosByIds(db, parsedIds);
      console.log(Bun.JSON5.stringify(todos, null, 2));
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown get error";
      console.error(`Get failed: ${message}`);
      process.exit(1);
    }
  }

  let limit = 1;
  if (numRaw) {
    const parsedLimit = Number.parseInt(numRaw, 10);
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      console.error("Invalid --num. Use a positive integer");
      process.exit(1);
    }
    limit = parsedLimit;
  }

  try {
    const todos = await getNextTodos(db, limit);
    console.log(Bun.JSON5.stringify(todos, null, 2));
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown get error";
    console.error(`Get failed: ${message}`);
    process.exit(1);
  }
}

if (command === "export") {
  const format = values.format ?? "json5";

  if (format !== "json5" && format !== "markdown") {
    console.error("Unsupported format. Use --format json5 or --format markdown");
    process.exit(1);
  }

  try {
    const payload = await getExportTree(db);
    const output = format === "json5" ? Bun.JSON5.stringify(payload, null, 2) : toMarkdown(payload);
    console.log(output);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown export error";
    console.error(`Export failed: ${message}`);
    console.error("Run `bun run db:migrate` first to initialize the database schema.");
    process.exit(1);
  }
}

console.error(`Unknown command: ${command}`);
printHelp();
process.exit(1);
