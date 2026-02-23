import { deleteTag, ensureTagPath, getTagById, updateTag } from "@/db";
import type { DbClient } from "@/db";
import { parsePositiveInteger } from "./shared";

type TagValues = {
  id?: string;
  name?: string;
  path?: string;
};

function normalizeTagName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!/^[a-z0-9]+$/.test(normalized)) {
    throw new Error("Invalid --name. Use lowercase alphanumeric text");
  }

  return normalized;
}

export async function runTagCommand(
  db: DbClient,
  subcommand: string | undefined,
  values: TagValues
): Promise<string> {
  if (!subcommand) {
    throw new Error("Missing tag subcommand. Use add, update, or delete");
  }

  if (subcommand === "add") {
    const path = values.path?.trim();
    if (!path) {
      throw new Error("Missing required --path option");
    }

    const tag = await ensureTagPath(db, path);
    return Bun.JSON5.stringify(tag, null, 2) ?? "";
  }

  if (subcommand === "update") {
    const idRaw = values.id?.trim();
    const nameRaw = values.name?.trim();

    if (!idRaw) {
      throw new Error("Missing required --id option");
    }

    if (!nameRaw) {
      throw new Error("Missing required --name option");
    }

    const id = parsePositiveInteger(idRaw, "--id");
    const name = normalizeTagName(nameRaw);

    const updated = await updateTag(db, id, { name });
    if (!updated) {
      throw new Error(`Tag ${id} not found`);
    }

    return Bun.JSON5.stringify(updated, null, 2) ?? "";
  }

  if (subcommand === "delete") {
    const idRaw = values.id?.trim();
    if (!idRaw) {
      throw new Error("Missing required --id option");
    }

    const id = parsePositiveInteger(idRaw, "--id");
    const tag = await getTagById(db, id);
    if (!tag) {
      throw new Error(`Tag ${id} not found`);
    }

    await deleteTag(db, id);

    return (
      Bun.JSON5.stringify(
        {
          deletedId: id,
          deletedName: tag.name
        },
        null,
        2
      ) ?? ""
    );
  }

  throw new Error(`Unknown tag subcommand: ${subcommand}`);
}
