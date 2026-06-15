## Why

The accepted design makes Konling the primary path-generation and adjustment entry, but the current path-advisor mode mostly reads existing path context. Students need a governed way to ask Konling for a path, revise options, and record path choices without letting client hints or chat text bypass scope and audit rules.

## What Changes

- Add scoped Konling tools for generating learning paths, revising options, explaining tradeoffs, selecting a path, and recording adjustment outcomes.
- Require all state-changing path tools to use server-owned context, permission checks, idempotency keys, and auditable tool-run records.
- Ensure student requests can include goal, time, difficulty rhythm, resource preference, checkpoint preference, external-resource permission, and natural-language intent.
- Keep Konling as the shared right-bottom dock; this change defines tools and runtime context, not a separate UI panel.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `konling-agent-runtime`: add governed adaptive path generation and revision tools.
- `adaptive-learning-path-planning`: define how Konling tool calls create, revise, select, and explain path options.

## Impact

- Affects Konling tool registry, agent sessions, tool-run persistence, adaptive planner integration, and student path-center context.
- Depends on generic path generation and governed resource-node semantics.
- Does not implement the visual path center pages.
