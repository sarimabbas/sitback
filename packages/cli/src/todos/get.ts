import { Command, EnumType } from "@cliffy/command";
import { countTodosForGet, getTagById, getTodosByIds, getTodosForGet, resolveTagPath } from "@sitback/db/queries";
import type { DbClient } from "@sitback/db/queries";
import { parsePositiveInteger, parsePriority } from "../shared";
import { dateYmdType, tagPathType } from "../types";

type TodoStatus = "todo" | "in_progress" | "completed" | "cancelled";
type OutputFormat = "json5" | "json" | "markdown";
type SortBy = "id" | "priority" | "due_date" | "created_at" | "updated_at";
type SortOrder = "asc" | "desc";
type TodoField =
  | "id"
  | "description"
  | "tagId"
  | "status"
  | "assignee"
  | "assigneeLease"
  | "workNotes"
  | "priority"
  | "dueDate"
  | "createdAt"
  | "updatedAt"
  | "isBlocked";

const todoStatusType = new EnumType(["todo", "in_progress", "completed", "cancelled"] as const);
const getFormatType = new EnumType(["json5", "json", "markdown"] as const);
const todoSortByType = new EnumType(["id", "priority", "due_date", "created_at", "updated_at"] as const);
const sortOrderType = new EnumType(["asc", "desc"] as const);
const todoFieldType = new EnumType(
  [
    "id",
    "description",
    "tagId",
    "status",
    "assignee",
    "assigneeLease",
    "workNotes",
    "priority",
    "dueDate",
    "createdAt",
    "updatedAt",
    "isBlocked"
  ] as const
);

type GetValues = {
  ids?: number[];
  num: number;
  numProvided?: boolean;
  blocked?: boolean;
  statuses?: TodoStatus[];
  inProgress?: boolean;
  minPriority?: number;
  dueBefore?: string;
  dueAfter?: string;
  tag?: string;
  tagId?: number;
  assignee?: string;
  hasAssignee?: boolean;
  leaseExpired?: boolean;
  format: OutputFormat;
  fields?: TodoField[];
  sortBy?: SortBy;
  order?: SortOrder;
  count?: boolean;
};

function toJsonOutput(value: unknown, format: OutputFormat) {
  if (format === "json") {
    return JSON.stringify(value, null, 2);
  }

  return Bun.JSON5.stringify(value, null, 2) ?? "";
}

function projectTodos(todos: Array<Record<string, unknown>>, fields?: TodoField[]) {
  if (!fields || fields.length === 0) {
    return todos;
  }

  return todos.map((todo) => {
    const projected: Partial<Record<TodoField, unknown>> = {};
    for (const field of fields) {
      projected[field] = todo[field];
    }
    return projected;
  });
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

function toMarkdownOutput(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "- (none)";
  }

  return rows
    .map((row) => {
      const pairs = Object.entries(row).map(([key, value]) => `${key}=${formatScalar(value)}`);
      return `- ${pairs.join(", ")}`;
    })
    .join("\n");
}

function formatTodosOutput(
  todos: Array<Record<string, unknown>>,
  options: {
    format: OutputFormat;
    fields?: TodoField[];
  }
) {
  const rows = projectTodos(todos, options.fields);

  if (options.format === "markdown") {
    return toMarkdownOutput(rows);
  }

  return toJsonOutput(rows, options.format);
}

function formatCountOutput(count: number, format: OutputFormat) {
  if (format === "markdown") {
    return String(count);
  }

  return toJsonOutput({ count }, format);
}

export async function runGetCommand(
  db: DbClient,
  values: GetValues
): Promise<{ output: string; warnings: string[] }> {
  const warnings: string[] = [];
  const idsRaw = values.ids;
  const num = values.num;
  const blocked = values.blocked;
  const statusesRaw = values.statuses;
  const inProgress = values.inProgress;
  const minPriorityRaw = values.minPriority;
  const dueBefore = values.dueBefore;
  const dueAfter = values.dueAfter;
  const tagPathRaw = values.tag;
  const tagIdRaw = values.tagId;
  const assigneeRaw = values.assignee;
  const hasAssignee = values.hasAssignee;
  const leaseExpired = values.leaseExpired;
  const format = values.format;
  const fields = values.fields;
  const sortBy = values.sortBy;
  const order = values.order;
  const count = values.count ?? false;
  const isNumProvided = values.numProvided ?? false;

  if (tagPathRaw && tagIdRaw !== undefined) {
    throw new Error("Use either --tag or --tag-id, not both");
  }

  const assignee = assigneeRaw?.trim();
  if (assigneeRaw !== undefined && !assignee) {
    throw new Error("Invalid --assignee. Provide non-empty text");
  }

  if (assignee && hasAssignee === false) {
    throw new Error("--assignee cannot be combined with --has-assignee=false");
  }

  let minPriority: number | undefined;
  if (minPriorityRaw !== undefined) {
    minPriority = parsePriority(minPriorityRaw, "--min-priority");
  }

  if (idsRaw !== undefined && isNumProvided) {
    warnings.push("Warning: --num is ignored when --ids is provided");
  }

  if (idsRaw !== undefined && (blocked !== undefined || minPriorityRaw !== undefined || dueBefore || dueAfter)) {
    warnings.push("Warning: --blocked/--min-priority/--due-before/--due-after are ignored when --ids is provided");
  }

  if (idsRaw !== undefined && (tagPathRaw || tagIdRaw !== undefined)) {
    warnings.push("Warning: --tag/--tag-id are ignored when --ids is provided");
  }

  if (idsRaw !== undefined && (statusesRaw || inProgress)) {
    warnings.push("Warning: --status/--in-progress are ignored when --ids is provided");
  }

  if (idsRaw !== undefined && (assigneeRaw !== undefined || hasAssignee !== undefined || leaseExpired !== undefined)) {
    warnings.push("Warning: --assignee/--has-assignee/--lease-expired are ignored when --ids is provided");
  }

  if (idsRaw !== undefined && (sortBy !== undefined || order !== undefined)) {
    warnings.push("Warning: --sort-by/--order are ignored when --ids is provided");
  }

  if (sortBy === undefined && order !== undefined) {
    warnings.push("Warning: --order is ignored without --sort-by");
  }

  const statusesSet = new Set<TodoStatus>(statusesRaw ?? []);
  if (inProgress) {
    statusesSet.add("in_progress");
  }
  const statuses = statusesSet.size > 0 ? Array.from(statusesSet) : undefined;

  if (idsRaw !== undefined) {
    const parsedIds = idsRaw.map((id) => parsePositiveInteger(id, "--ids"));
    const todos = await getTodosByIds(db, parsedIds);

    if (count) {
      return {
        output: formatCountOutput(todos.length, format),
        warnings
      };
    }

    return {
      output: formatTodosOutput(todos as Array<Record<string, unknown>>, { format, fields }),
      warnings
    };
  }

  const limit = parsePositiveInteger(num, "--num");

  let resolvedTagId: number | undefined;
  if (tagIdRaw !== undefined) {
    const parsedTagId = parsePositiveInteger(tagIdRaw, "--tag-id");
    const tag = await getTagById(db, parsedTagId);
    if (!tag) {
      return {
        output: Bun.JSON5.stringify([], null, 2) ?? "",
        warnings
      };
    }
    resolvedTagId = parsedTagId;
  }

  if (tagPathRaw) {
    const tag = await resolveTagPath(db, tagPathRaw);
    if (!tag) {
      return {
        output: Bun.JSON5.stringify([], null, 2) ?? "",
        warnings
      };
    }
    resolvedTagId = tag.id;
  }

  if (count) {
    const total = await countTodosForGet(db, {
      blocked,
      statuses,
      minPriority,
      dueBefore,
      dueAfter,
      tagId: resolvedTagId,
      assignee,
      hasAssignee,
      leaseExpired
    });

    return {
      output: formatCountOutput(total, format),
      warnings
    };
  }

  const todos = await getTodosForGet(db, {
    limit,
    blocked,
    statuses,
    minPriority,
    dueBefore,
    dueAfter,
    tagId: resolvedTagId,
    assignee,
    hasAssignee,
    leaseExpired,
    sortBy,
    sortOrder: order
  });

  return {
    output: formatTodosOutput(todos as Array<Record<string, unknown>>, { format, fields }),
    warnings
  };
}

export function createTodoGetCommand(db: DbClient) {
  return new Command()
    .type("todo-status", todoStatusType)
    .type("get-format", getFormatType)
    .type("todo-sort-by", todoSortByType)
    .type("sort-order", sortOrderType)
    .type("todo-field", todoFieldType)
    .type("tag-path", tagPathType)
    .type("date-ymd", dateYmdType)
    .description("Get todos")
    .option("--ids <ids:integer[]>", "Comma-separated todo IDs")
    .option("--num <num:integer>", "Number of todos to return", {
      default: 20,
      defaultText: "20"
    })
    .option("--blocked <blocked:boolean>", "Filter by blocked state (true|false)")
    .option("--status <status:todo-status[]>", "Comma-separated todo statuses")
    .option("--in-progress", "Shortcut for --status in_progress")
    .option("--min-priority <value:integer>", "Minimum priority filter (1-5)")
    .option("--due-before <value:date-ymd>", "Filter by due date upper bound")
    .option("--due-after <value:date-ymd>", "Filter by due date lower bound")
    .option("--tag <tag:tag-path>", "Filter by slash tag path")
    .option("--tag-id <value:integer>", "Filter by tag ID")
    .option("--assignee <value:string>", "Filter by assignee")
    .option("--has-assignee <value:boolean>", "Filter for assigned vs unassigned todos")
    .option("--lease-expired <value:boolean>", "Filter by lease expiry state")
    .option("--sort-by <value:todo-sort-by>", "Sort field")
    .option("--order <value:sort-order>", "Sort direction used with --sort-by")
    .option("--fields <value:todo-field[]>", "Comma-separated output fields")
    .option("--count", "Return count instead of todo rows")
    .option("--format <value:get-format>", "Output format", {
      default: "json5",
      defaultText: "json5"
    })
    .action(async function (this: { getRawArgs: () => string[] }, options) {
      const rawArgs = this.getRawArgs();
      const numProvided = rawArgs.some((arg) => arg === "--num" || arg.startsWith("--num="));

      const result = await runGetCommand(db, {
        ids: options.ids,
        num: options.num,
        numProvided,
        blocked: options.blocked,
        statuses: options.status,
        inProgress: options.inProgress,
        minPriority: options.minPriority,
        dueBefore: options.dueBefore,
        dueAfter: options.dueAfter,
        tag: options.tag,
        tagId: options.tagId,
        assignee: options.assignee,
        hasAssignee: options.hasAssignee,
        leaseExpired: options.leaseExpired,
        format: options.format,
        fields: options.fields,
        sortBy: options.sortBy,
        order: options.order,
        count: options.count
      });

      for (const warning of result.warnings) {
        console.error(warning);
      }

      console.log(result.output);
    });
}
