import { eq } from "drizzle-orm";
import { todoDependenciesTable } from "../schema";
import type { DbClient } from "./types";

export async function addDependency(db: DbClient, successorId: number, predecessorId: number) {
  await db.insert(todoDependenciesTable).values({ successorId, predecessorId }).execute();
}

export async function replaceTodoPredecessors(
  db: DbClient,
  successorId: number,
  predecessorIds: number[]
) {
  const uniquePredecessorIds = Array.from(new Set(predecessorIds));

  await db.transaction(async (tx) => {
    await tx.delete(todoDependenciesTable).where(eq(todoDependenciesTable.successorId, successorId));

    for (const predecessorId of uniquePredecessorIds) {
      await tx.insert(todoDependenciesTable).values({ successorId, predecessorId }).execute();
    }
  });
}
