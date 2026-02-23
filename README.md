# sitback

![relax](./docs/relax.gif)

> @pokithehamster

`sitback` is a todo manager that pairs well with parallel AI agents and Ralph loops.

Todos can be structured as DAGs, and more todos can be added while the DAG is being worked on. This can be useful for combinatorially explosive problems.

Usually, AI agents will use a `TODO.md` file, but to efficiently manage context, `sitback` is backed by a SQLite database and comes with a CLI to allow AI agents to request work and mark work as completed.

`sitback` also comes with a web UI to make it easy to manage todos in graph or Kanban views. Nested tags can be used to organize multiple projects.

## Interface

```bash
sb add --tag "tag1,tag2" "This is a todo item"
sb request --tag "tag1" --num 2
sb complete <todo_id>
sb export --format markdown > TODO.md
```

## Scripts

```bash
# run CLI
bun run dev
bun run start

# build standalone binary
bun run build:bin

# database workflows (use one approach)
bun run db:push
# or
bun run db:generate
bun run db:migrate

# inspect DB with Drizzle Studio
bun run db:studio
```
