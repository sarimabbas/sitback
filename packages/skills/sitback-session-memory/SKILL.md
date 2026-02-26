---
name: sitback-session-memory
description: Use sitback as durable shared memory for long-running agent work. Use this whenever work spans many steps, multiple agents, or likely compaction/handoffs. Route quickly to planner or worker guidance, keep notes in todo work-notes, and use todo claim for atomic pull-based queues.
---

# Sitback Session Memory

Use this skill when work is too large for one uninterrupted run.

Core idea:

- Keep plan and progress in sitback todos.
- Use predecessors for "do this first" ordering.
- Use `work-notes` as durable state.
- Use `todo claim` for atomic queue-based work pickup.

## Quick routing

Choose your role first, then read only that reference:

- Planner/orchestrator role -> read `references/planner.md`
- Worker/executor role -> read `references/worker.md`

If unclear, default to planner guidance.

## Shared checkpoint format

Both planner and workers should use this note shape:

```text
Session key: <key>
Context: <current objective>
Last action: <what just happened>
Result: <outcome + key evidence>
Next: <single next step>
Risks: <blocker/risk or none>
```

Write a checkpoint after each milestone and before stopping.
