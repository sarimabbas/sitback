# Agents Guide

## Runtime and tooling

- Use Bun as the default runtime and package manager.
- Prefer `bun <file>`, `bun run <script>`, `bun test`, `bun build`, `bun install`, and `bunx <tool>`.
- Do not add `dotenv` bootstrap code; Bun loads `.env` automatically.

## App conventions

- Prefer Bun-native APIs when practical (`Bun.serve`, `Bun.file`, Bun SQL/Redis APIs).
- Keep TypeScript strict; run `bun run lint` and `bun run test` for verification.

## SQLite migration and trigger policy

- Triggers do **not** need to be recreated for every migration.
- Recreate triggers when a migration rebuilds, drops, or renames a table they depend on.
- Risk pattern: SQLite rebuild migrations using `__new_*` table, copy, drop old, rename new.
- For rebuild migrations, drop affected triggers before table swap and recreate them after rename.
- Keep trigger logic in custom SQL migrations when needed.
- After migration edits, run:
  - `bun run lint`
  - `bun run test`

## Why this matters

The DAG guarantees for todos/tags rely on triggers (cycle prevention and completion guards). If triggers are not recreated after table rebuilds, those protections can be lost.
