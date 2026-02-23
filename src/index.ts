import { parseArgs } from "util";
import { db, getExportTree, initializeSqlitePragmas } from "./db";
import type { ExportTagNode, ExportTodoNode } from "./db";

await initializeSqlitePragmas();

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`sitback v${VERSION}

Usage:
  sb help
  sb export [--format json5|markdown]
  sb --help
  sb -h

Commands:
  help      Show this help output
  export    Export tag and todo trees

Global options:
  -h, --help     Show help

Examples:
  sb help
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
    format: { type: "string" }
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
