type SqliteClient = {
  execute: (statement: string) => Promise<unknown>;
};

type SqliteDbWithClient = {
  $client: SqliteClient;
};

export async function applySqlitePragmas(db: SqliteDbWithClient): Promise<void> {
  await db.$client.execute("PRAGMA journal_mode = WAL;");
  await db.$client.execute("PRAGMA synchronous = NORMAL;");
}
