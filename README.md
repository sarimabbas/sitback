# sitback

![relax](./docs/relax.gif)

> @pokithehamster

`sitback` is a todo manager that pairs well with parallel AI agents and Ralph loops.

Todos can be structured as DAGs, and more todos can be added while the DAG is being worked on. This can be useful for combinatorially explosive problems.

Usually, AI agents will use a `TODO.md` file, but to efficiently manage context, `sitback` is backed by a SQLite database and comes with a CLI to allow AI agents to request work and mark work as completed.

`sitback` also comes with a web UI to make it easy to manage todos in graph or Kanban views. Nested tags can be used to organize multiple projects.

## Interface

```bash
sb todo add --description "Read paper A" --tag research/mapreduce --status todo
sb todo get --num 3
sb todo update --id 7 --status in_progress
sb todo delete --ids 3,5
sb tag get
sb export --format markdown > TODO.md
```

## Examples

### Build a MapReduce-style DAG from URLs

Use this when planning parallel web research (map phase) followed by one reducer task that depends on all map tasks.

```bash
#!/usr/bin/env bash
set -euo pipefail

# optional: isolate this plan in its own local DB folder
export SITBACK_CONFIG_DIR="/tmp/sitback-paper-plan"

# 1) create map tasks in parallel-friendly form
urls=(
  "https://arxiv.org/abs/1706.03762"
  "https://arxiv.org/abs/2005.14165"
  "https://arxiv.org/abs/2401.00001"
)

map_ids=()

for url in "${urls[@]}"; do
  result="$(sb todo add \
    --description "Research and summarize ${url}" \
    --tag "research/papers/map" \
    --status todo \
    --priority 4 \
    --input-artifacts "${url}" \
    --output-artifacts "notes/$(basename "${url}").md")"

  # extract created todo id from JSON5 output
  id="$(printf '%s\n' "$result" | rg '^\s*id:' | head -n1 | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
  map_ids+=("$id")
done

# 2) create reducer task that depends on all map tasks
preds="$(IFS=,; echo "${map_ids[*]}")"

sb todo add \
  --description "Merge all paper summaries into one synthesis" \
  --tag "research/papers/reduce" \
  --status todo \
  --priority 5 \
  --work-notes "Wait until all map tasks are completed" \
  --output-artifacts "reports/paper-synthesis.md" \
  --predecessors "$preds"

# 3) ask for next actionable work
sb todo get --num 5
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

# local-dev only: reset/squash migration history to a fresh baseline
bun run db:squash

# inspect DB with Drizzle Studio
bun run db:studio
```
