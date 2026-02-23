import { eq } from "drizzle-orm";
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
