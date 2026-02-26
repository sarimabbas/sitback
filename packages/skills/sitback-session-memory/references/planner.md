# Planner Guide

Use this when you are decomposing work, spawning workers, and controlling integration quality.

Lane definition:

- A lane is a tag-based work stream (for example `planner/session-x/impl`, `planner/session-x/eval`, `planner/session-x/synth`).
- Lanes separate different kinds of work so workers can pull from the right queue.

## TOC

- Start the run
- Pick mode (assigned vs pull queue)
- Create packet todos
- Common patterns
  - Sequential chain
  - Parallel shards
  - Map-reduce
- Bounded parallelism
- Contracts and quality gates
- Governance for DAG growth
- Optional hooks guardrails

## 1) Start the run

Create one parent todo:

```bash
bun run packages/cli/src/index.ts todo add \
  --description "planner session: <initiative>" \
  --tag "planner/<session>/parent" \
  --status in_progress \
  --priority 5 \
  --work-notes "Session key: planner\nContext: orchestrate <initiative>\nLast action: parent created\nResult: pending\nNext: create packet todos\nRisks: none"
```

## 2) Pick mode: assigned vs pull queue

- Assigned mode: planner gives each worker a specific `TODO_ID`.
- Pull queue mode: workers fetch work with `todo claim` (usually lane-scoped via `--tag`).

For native subagents, prefer assigned mode.
For worker pools, prefer pull queue mode.

## 3) Create packet todos

```bash
bun run packages/cli/src/index.ts todo add \
  --description "packet agent-a: <objective A>" \
  --tag "planner/<session>/impl" \
  --status todo \
  --work-notes "Session key: agent-a\nContext: <goal A>\nLast action: task assigned\nResult: pending\nNext: start implementation\nRisks: none"
```

## 4) Common patterns

### Sequential chain (A -> B -> C -> Synthesis)

Use predecessors to force order:

```bash
bun run packages/cli/src/index.ts todo add --description "A: gather sources" --tag "planner/<session>/chain" --status todo
bun run packages/cli/src/index.ts todo add --description "B: normalize findings" --tag "planner/<session>/chain" --status todo --predecessors "<A_ID>"
bun run packages/cli/src/index.ts todo add --description "C: critique" --tag "planner/<session>/chain" --status todo --predecessors "<B_ID>"
bun run packages/cli/src/index.ts todo add --description "Synthesis: final report" --tag "planner/<session>/synth" --status todo --predecessors "<C_ID>"
```

### Parallel shards

Split one large task into N shard todos up front.

Use this shard note snippet in each shard:

```text
Shard: 3/12
Shard scope: <partition rule>
```

Then create one synthesis todo that depends on all shard IDs.

### Map-reduce

Map tasks run in parallel; reduce depends on all map tasks.

```bash
export SITBACK_CONFIG_DIR="/tmp/sitback-mapreduce"

urls=(
  "https://arxiv.org/abs/1706.03762"
  "https://arxiv.org/abs/2005.14165"
  "https://arxiv.org/abs/2401.00001"
)

map_ids=()
for url in "${urls[@]}"; do
  out="$(bun run packages/cli/src/index.ts todo add --description "map: summarize ${url}" --tag "planner/papers/map" --status todo)"
  id="$(printf '%s\n' "$out" | rg '^\s*id:' | head -n1 | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
  map_ids+=("$id")
done

preds="$(IFS=,; echo "${map_ids[*]}")"
bun run packages/cli/src/index.ts todo add --description "reduce: synthesize map outputs" --tag "planner/papers/reduce" --status todo --predecessors "$preds"
```

## 5) Bounded parallelism

Set limits before spawning:

- `global_cap`: max in-progress packets
- `synthesis_cap`: usually `1`

Suggested defaults:

- small repo: `global_cap=2`
- medium repo: `global_cap=4`

Queue-mode enforcement tip:

- Use lane-scoped claims like `todo claim --assignee <worker> --tag planner/<session>/<lane>` so workers stay in their intended queue.

## 6) Contracts and quality gates

Add evaluator todos, not just reminders.

Flow:

1. `impl/<x>` produces candidate output
2. `eval/<x>` depends on `impl/<x>` and runs checks
3. `synth/<x>` depends on eval packets

Contract snippet for packet notes:

```text
Contract:
- Scope: <allowed files/areas>
- Definition of done: <artifact + behavior>
- Required checks: <commands>
- Failure policy: <blocked|retry|replan>
```

## 7) Governance for DAG growth

Pick one mode and write it in parent notes:

- Planner-locked: only planner creates nodes
- Bounded autonomy (recommended): workers can propose/create follow-ups with constraints
- Fully autonomous: workers can freely create/rewire

Bounded autonomy constraints:

- tag proposed nodes as `planner/<session>/proposed`
- include predecessor IDs
- include `Why`, `Impact`, `Suggested next` in notes
- cap nodes per worker before planner acknowledgement

## 8) Optional hooks guardrails

If hooks are available, add lightweight checks:

- `PreToolUse`: block risky commands
- `SubagentStop`: require concrete evidence in notes
- `Stop`: require required eval packets complete
- `PreCompact`: force a final checkpoint write

Keep hooks fast and mostly deterministic.
