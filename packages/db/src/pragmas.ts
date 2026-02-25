type SqliteStatement = {
  run: () => unknown;
};

type SqliteClient = {
  query: (statement: string) => SqliteStatement;
};

type SqliteDbWithClient = {
  $client: SqliteClient;
};

export async function applySqlitePragmas(db: SqliteDbWithClient): Promise<void> {
  db.$client.query("PRAGMA foreign_keys = ON;").run();
  db.$client.query("PRAGMA busy_timeout = 5000;").run();
  db.$client.query("PRAGMA journal_mode = WAL;").run();
  db.$client.query("PRAGMA synchronous = NORMAL;").run();
}
