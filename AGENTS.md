# Agents Guide

## Runtime and tooling

- Use Bun as the default runtime and package manager.
- Prefer `bun <file>`, `bun run <script>`, `bun test`, `bun build`, `bun install`, and `bunx <tool>`.
- Use `bun -e "..."` for quick ad-hoc one-liners when you need to inspect runtime behavior or test tiny snippets.
- Do not add `dotenv` bootstrap code; Bun loads `.env` automatically.

## App conventions

- Prefer Bun-native APIs when practical (`Bun.serve`, `Bun.file`, Bun SQL/Redis APIs).
- Keep TypeScript strict; run `bun run lint` and `bun run test` for verification.
- Useful manual CLI smoke test for add command:
  - `SITBACK_CONFIG_DIR="/tmp/sitback-add-extra" bun run src/index.ts todo add --description "compile report" --status todo --priority 2 --due-date 2031-04-15 --input-artifacts "logs/build.log" --output-artifacts "reports/build.md" --work-notes "Investigate flaky step"`
- Keep `docs/code-structure.md` in sync whenever functions are added, removed, renamed, or moved.
- After updating the diagram, validate it by rendering with Mermaid CLI:
  - `bunx @mermaid-js/mermaid-cli -i docs/code-structure.md -o /tmp/sitback-code-structure.svg`

## CLI/Cliffy conventions

- Prefer Cliffy primitives over custom parsing/validation in action handlers.
- Use option metadata first:
  - `required: true` for mandatory options.
  - `default` and `defaultText` for default behavior and help display.
  - Built-in types (`boolean`, `integer`, `number`, `file`, `secret`) where applicable.
  - List types (`<value:type[]>`) for comma-separated inputs (for example ID lists), instead of manual `split(",")` parsing.
  - `EnumType`/custom `.type(...)` for constrained or structured value sets (for example formats/status values, date strings, slash paths).
- Keep command handlers focused on domain rules that Cliffy cannot express (for example positive integer constraints, cross-option constraints, DB existence checks).
- Avoid duplicating "missing required" or enum validation errors in handler code when Cliffy already guarantees them.
- If parser defaults affect warning behavior, detect whether a flag was explicitly passed (for example via `this.getRawArgs()`) before emitting "ignored option" warnings.

## SQLite migration and trigger policy

- Triggers do **not** need to be recreated for every migration.
- Recreate triggers when a migration rebuilds, drops, or renames a table they depend on.
- Risk pattern: SQLite rebuild migrations using `__new_*` table, copy, drop old, rename new.
- For rebuild migrations, drop affected triggers before table swap and recreate them after rename.
- Canonical trigger/custom SQL lives in `src/db/custom-migrations.sql`.
- Preserve trigger/custom migration logic by copying the relevant SQL blocks from `src/db/custom-migrations.sql` into each custom Drizzle migration that touches affected tables.
- Use `bun run db:squash` only when the developer explicitly asks for it during local development setup and you intentionally want to reset migration history to a new baseline.
- `db:squash` rewrites migration history, generates a fresh baseline migration, appends `src/db/custom-migrations.sql` into that new migration, and runs migrate.
- Do **not** use `db:squash` on shared/staging/production databases or after migrations are already distributed to other environments.
- After migration edits, run:
  - `bun run lint`
  - `bun run test`

## Why this matters

The DAG guarantees for todos/tags rely on triggers (cycle prevention and completion guards). If triggers are not recreated after table rebuilds, those protections can be lost.
