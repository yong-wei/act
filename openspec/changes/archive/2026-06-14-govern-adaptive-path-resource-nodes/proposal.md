## Why

The accepted path-center design requires paths to cover the full platform and visually distinguish resource types, but the current ResourceNode registry lacks first-class external-resource and checkpoint semantics. Without a governed node vocabulary, the UI would either invent page-local types or treat checks and external links as ordinary resources.

## What Changes

- Add governed path node types for external resources, checkpoints, control workbench tasks, adaptive quizzes, and Konling support where existing types are ambiguous.
- Define stable display names, icon semantics, launch targets, evidence status, and eligibility rules for every path resource type listed in the handoff.
- Require external resources to carry title, source, URL, estimated time, knowledge coverage, applicability, and evidence-use status.
- Require checkpoints to be visually and semantically distinct from ordinary resource nodes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `resource-node-registry`: extend the path-plannable resource vocabulary and audit contract.
- `adaptive-learning-path-planning`: require generated paths to use governed resource-node types and checkpoints.

## Impact

- Affects resource-node types, registry builders, seed data, audits, path payloads, and UI icon mapping.
- Supports the visual language in `artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md` and `concepts/02-path-selection-comparison.png`.
- Does not fetch or rank external resources directly; it only defines the governed contract.
