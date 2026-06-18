## Context

The accepted design defines a sequence: landing, editable generation, option selection, current path execution, and evidence review. Current behavior blends these states, causing jumpy copy, stale buttons, unselectable preset goals, and missing current-path context. This change composes the sibling contracts into a coherent workspace.

## Goals / Non-Goals

**Goals:**

- Define route intents for `none`, `contextual-recommendation`, `path-selection`, `path-execution`, and `evidence-review`.
- Render exactly one primary workspace for each intent.
- Preserve active path and option context while moving between states.
- Verify desktop and mobile screenshots against the Product Design visual contract.

**Non-Goals:**

- Re-implementing the generation panel fields.
- Re-implementing readiness-gate logic.
- Re-implementing complex-node result binding.

## Decisions

- Route intent is the workspace state source. The URL must be shareable and restorable for path execution and evidence review.
- Landing owns only generation, continuation, and evidence entry. It must not show unreachable preset-path cards as the main product experience.
- Mobile uses task-first panels or tabs; desktop uses AppShell workspace regions.
- The design contract is accepted only when visual QA references both expected visuals and current-state screenshots, making divergence explicit.

## Risks / Trade-offs

- Splitting states may reveal missing data in existing services. Mitigation: render honest empty states and keep recovery actions in the active intent.
- Query parameters can grow. Mitigation: keep URL intent and path id stable while storing heavier state in persisted path records.
- Visual QA can become subjective. Mitigation: require named expected image paths, current screenshot paths, and PASS/FAIL notes for each state.
