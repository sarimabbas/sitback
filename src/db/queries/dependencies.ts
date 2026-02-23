import { todoDependenciesTable } from "../schema";
import type { DbClient } from "./types";

export async function addDependency(db: DbClient, successorId: number, predecessorId: number) {
  await db.insert(todoDependenciesTable).values({ successorId, predecessorId }).execute();
}
