type SqliteStatement = {
  run: () => unknown;
};

type SqliteClient = {
  query?: (statement: string) => SqliteStatement;
  prepare?: (statement: string) => SqliteStatement;
};

type SqliteDbWithClient = {
  $client: SqliteClient;
};

export async function applySqlitePragmas(db: SqliteDbWithClient): Promise<void> {
  const run = (statement: string) => {
    if (db.$client.query) {
      db.$client.query(statement).run();
      return;
    }

    if (db.$client.prepare) {
      db.$client.prepare(statement).run();
      return;
    }

    throw new Error("Unsupported SQLite client: expected query() or prepare() method");
  };

  run("PRAGMA foreign_keys = ON;");
  run("PRAGMA busy_timeout = 5000;");
  run("PRAGMA journal_mode = WAL;");
  run("PRAGMA synchronous = NORMAL;");
}
