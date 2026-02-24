import { Command } from "@cliffy/command";
import { getExportTree } from "@/db";
import type { DbClient, ExportTagNode, ExportTodoNode } from "@/db";

type ExportValues = {
  format?: string;
};

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

export async function runExportCommand(db: DbClient, values: ExportValues): Promise<string> {
  const format = values.format ?? "json5";

  if (format !== "json5" && format !== "markdown") {
    throw new Error("Unsupported format. Use --format json5 or --format markdown");
  }

  const payload = await getExportTree(db);
  return format === "json5" ? (Bun.JSON5.stringify(payload, null, 2) ?? "") : toMarkdown(payload);
}

export function createExportCommand(db: DbClient) {
  return new Command()
    .description("Export tag and todo trees")
    .option("--format <format:string>", "json5 | markdown")
    .action(async (options) => {
      try {
        const output = await runExportCommand(db, {
          format: options.format
        });
        console.log(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown export command error";
        console.error(`Export failed: ${message}`);
        console.error("Run `bun run db:migrate` first to initialize the database schema.");
        process.exit(1);
      }
    });
}
