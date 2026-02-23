import { and, eq, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { tagsTable, todosTable } from "../schema";
import type { DbClient, TagInsert, TagUpdate } from "./types";

type TagTreeNode = {
  id: number;
  name: string;
  parentId: number | null;
  children: TagTreeNode[];
};

function sortTagTree(node: TagTreeNode): void {
  node.children.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  for (const child of node.children) {
    sortTagTree(child);
  }
}

function buildTagForest(rows: Array<{ id: number; name: string; parentId: number | null }>) {
  const nodesById = new Map<number, TagTreeNode>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        parentId: row.parentId,
        children: []
      }
    ])
  );

  const roots: TagTreeNode[] = [];

  for (const node of nodesById.values()) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }

    const parent = nodesById.get(node.parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  roots.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  for (const root of roots) {
    sortTagTree(root);
  }

  return {
    roots,
    nodesById
  };
}

export async function createTag(db: DbClient, tag: TagInsert) {
  const [created] = await db.insert(tagsTable).values(tag).returning();

  return created;
}

export async function getTagById(db: DbClient, id: number) {
  const [row] = await db.select().from(tagsTable).where(eq(tagsTable.id, id));

  return row;
}

export async function getTags(db: DbClient) {
  return db.select().from(tagsTable);
}

export async function updateTag(db: DbClient, id: number, changes: TagUpdate) {
  const [updated] = await db.update(tagsTable).set(changes).where(eq(tagsTable.id, id)).returning();

  return updated;
}

export async function deleteTag(db: DbClient, id: number) {
  const [deleted] = await db.delete(tagsTable).where(eq(tagsTable.id, id)).returning();

  return deleted;
}

async function findTagByNameAndParent(db: DbClient, name: string, parentId: number | null) {
  const whereClause =
    parentId === null
      ? and(eq(tagsTable.name, name), isNull(tagsTable.parentId))
      : and(eq(tagsTable.name, name), eq(tagsTable.parentId, parentId));

  const [existing] = await db.select().from(tagsTable).where(whereClause);

  return existing;
}

function normalizeTagPath(tagPath: string): string[] {
  const segments = tagPath.split("/").map((segment) => segment.trim());

  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) {
    throw new Error("Tag path must not contain empty segments");
  }

  const normalized = segments.map((segment) => segment.toLowerCase());

  if (normalized.some((segment) => !/^[a-z0-9]+$/.test(segment))) {
    throw new Error("Tag path segments must be lowercase alphanumeric");
  }

  return normalized;
}

export async function resolveTagPath(db: DbClient, tagPath: string) {
  const segments = normalizeTagPath(tagPath);

  let parentId: number | null = null;
  let currentTag: Awaited<ReturnType<typeof getTagById>> | undefined;

  for (const segment of segments) {
    const existing = await findTagByNameAndParent(db, segment, parentId);
    if (!existing) {
      return undefined;
    }

    currentTag = existing;
    parentId = existing.id;
  }

  return currentTag;
}

export async function ensureTagPath(db: DbClient, tagPath: string) {
  const segments = normalizeTagPath(tagPath);
  const resolved = await resolveTagPath(db, tagPath);

  if (resolved) {
    return resolved;
  }

  let parentId: number | null = null;
  let currentTag: Awaited<ReturnType<typeof getTagById>> | undefined;

  for (const segment of segments) {
    const existing = await findTagByNameAndParent(db, segment, parentId);

    if (existing) {
      currentTag = existing;
      parentId = existing.id;
      continue;
    }

    const created = await createTag(db, parentId === null ? { name: segment } : { name: segment, parentId });

    currentTag = created;
    parentId = created?.id ?? null;
  }

  if (!currentTag) {
    throw new Error("Failed to resolve tag path");
  }

  return currentTag;
}

export async function getTagSummary(db: DbClient, id: number) {
  const tag = await getTagById(db, id);

  if (!tag) {
    return undefined;
  }

  const descendantRows = await db
    .select({
      id: tagsTable.id,
      name: tagsTable.name,
      parentId: tagsTable.parentId
    })
    .from(tagsTable)
    .where(sql`${tagsTable.id} in (
      with recursive descendants(id) as (
        select ${id}
        union all
        select t.id
        from tags t
        join descendants d on t.parent_id = d.id
      )
      select id from descendants
    )`);

  const { nodesById } = buildTagForest(descendantRows);

  const tagTree = nodesById.get(id);
  if (!tagTree) {
    return undefined;
  }

  sortTagTree(tagTree);

  const [countRow] = await db
    .select({
      todoCount: sql<number>`count(*)`
    })
    .from(todosTable)
    .where(sql`${todosTable.tagId} in (
      with recursive descendants(id) as (
        select ${id}
        union all
        select t.id
        from tags t
        join descendants d on t.parent_id = d.id
      )
      select id from descendants
    )`);

  return {
    tag,
    tagTree,
    todoCount: countRow?.todoCount ?? 0
  };
}

export async function getAllTagsSummary(db: DbClient) {
  const allTags = await db
    .select({
      id: tagsTable.id,
      name: tagsTable.name,
      parentId: tagsTable.parentId
    })
    .from(tagsTable);

  const { roots } = buildTagForest(allTags);

  const [countRow] = await db
    .select({
      todoCount: sql<number>`count(*)`
    })
    .from(todosTable)
    .where(sql`${todosTable.tagId} is not null`);

  return {
    tagTree: roots,
    todoCount: countRow?.todoCount ?? 0
  };
}
