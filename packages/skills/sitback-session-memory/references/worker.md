# Worker Guide

Use this when you are executing one packet todo.

## 1) Determine worker mode

- Assigned mode: planner gave you a `TODO_ID`.
- Pull queue mode: claim work from queue with `todo claim`.

Tag scope rule:

- Stay inside the project/epic root tag chosen by the planner.
- In pull queue mode, use `--tag` under that root (for example `.../impl`).

## 2) Assigned mode

Do not pull queue work. Operate on the assigned ID.

Checkpoint update:

```bash
bun run packages/cli/src/index.ts todo update --id <TODO_ID> --work-notes "Session key: <KEY>\nContext: <...>\nLast action: <...>\nResult: <...>\nNext: <...>\nRisks: <...>"
```

Completion:

```bash
bun run packages/cli/src/index.ts todo update --id <TODO_ID> --status completed --work-notes "Session key: <KEY>\nContext: completed\nLast action: final verification\nResult: <evidence>\nNext: none\nRisks: none"
```

## 3) Pull queue mode

Use atomic claim:

```bash
claimed="$(bun run packages/cli/src/index.ts todo claim --assignee worker-3 --tag planner/session-x/impl --lease-minutes 20)"

if [ "$claimed" = "null" ]; then
  sleep 2
  exit 0
fi

id="$(printf '%s\n' "$claimed" | rg '^\s*id:' | head -n1 | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
```

Claim rules:

- claim returns one claimable todo or `null`
- claimable means not completed, not blocked, and unassigned or lease-expired
- claim sets `status=in_progress`, `assignee`, and `assigneeLease`
- `--tag` / `--tag-id` scopes claims to a tag subtree (preferred for lane routing)

Then run your packet and checkpoint:

```bash
bun run packages/cli/src/index.ts todo update --id "$id" --work-notes "Session key: worker-3\nContext: <packet>\nLast action: claimed\nResult: started\nNext: execute task\nRisks: none"
```

Complete when done:

```bash
bun run packages/cli/src/index.ts todo update --id "$id" --status completed --work-notes "Session key: worker-3\nContext: completed\nLast action: execution finished\nResult: <evidence>\nNext: none\nRisks: none"
```

## 4) Lease handling

- Set lease longer than expected runtime.
- Prefer smaller packets over very long leases.
- If runtime exceeds lease often, ask planner to re-scope or increase lease.

Manual lease extension (if needed):

```bash
bun run packages/cli/src/index.ts todo update --id "$id" --assignee-lease "YYYY-MM-DD HH:MM:SS"
```

## 5) Evidence quality

Good `Result` lines include concrete evidence, for example:

- `Result: build passed (bun --filter '@sitback/web' build)`
- `Result: fixed route type error in packages/web/src/routes/demo/drizzle.tsx`
- `Result: blocked; missing tag planner/session-x/impl and no claimable todo`

## 6) Recovery after stop/compaction

1. Re-read your packet todo.
2. Resume from `Next`.
3. Write a fresh checkpoint after first resumed action.

## 7) Context from related todos (recommended with limits)

Before starting a packet, read nearby context briefly:

1. Parent todo work-notes (required)
2. Immediate predecessor todo work-notes (required if present)
3. Up to 2 sibling todos in the same lane (optional)

Goal: pick up decisions and avoid duplicate work, not full replay.

Overload guardrails:

- Timebox
- Stop once you can restate current objective + next step
- If notes conflict, trust predecessors and add a risk line in your checkpoint
