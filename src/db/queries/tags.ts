import { and, eq, isNull } from "drizzle-orm";
import { tagsTable } from "../schema";
import type { DbClient, TagInsert, TagUpdate } from "./types";

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

export async function ensureTagPath(db: DbClient, tagPath: string) {
  const segments = normalizeTagPath(tagPath);

  let parentId: number | null = null;
  let currentTag: Awaited<ReturnType<typeof getTagById>> | undefined;

  for (const segment of segments) {
    const existing = await findTagByNameAndParent(db, segment, parentId);

    if (existing) {
      currentTag = existing;
      parentId = existing.id;
      continue;
    }

    const created = await createTag(
      db,
      parentId === null ? { name: segment } : { name: segment, parentId }
    );

    currentTag = created;
    parentId = created?.id ?? null;
  }

  if (!currentTag) {
    throw new Error("Failed to resolve tag path");
  }

  return currentTag;
}
