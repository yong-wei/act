## Context

The current manifest loader accepts `kind: string` and `payload: Record<string, unknown>`. The shared content registry already proves that many existing kinds are aliases: card-like kinds render through the same summary/card components, table-like kinds render through the same table component, figure-like kinds render through the same image panel, and reveal-like kinds render through the same progressive reveal component.

The taxonomy should therefore describe product-level module classes, not preserve every historical name as a first-class type.

## Design

Define a canonical taxonomy with these classes:

- `content.rich`: prose, notes, problem statements, summaries, references, teacher-facing context.
- `content.cardSet`: repeated cards or lists with a common role.
- `content.formula`: formulas, symbol explanations, formula groups.
- `content.table`: native tables, comparison tables, record tables.
- `content.figure`: images, SVG/native diagrams, static figures, galleries.
- `content.reveal`: progressive reveal chains, derivations, staged reasoning.
- `content.stageMap`: course path, stage map, route indicator.
- `activity.panel`: the visible activity slot that hosts one or more activity cards.
- `activity.workspace`: structured workspaces, worked-example forms, parameter records.
- `compute.panel`: interactive or computed visualization panels bound to a registered capability.
- `analytics.summary`: lesson or class evidence summaries.
- `layout.support`: title, route, and page-support modules that do not create learning evidence.
- `legacy.adapter`: migration-only alias surface; new lessons must not create it.

Each module instance should carry orthogonal configuration instead of encoding it in `kind`:

- `presentation.layout`: `single`, `row`, `grid`, `strip`, `tabs`, or similar presentation choices.
- `semanticRole`: goal, boundary, example, risk, teacherHint, referenceAnswer, misconception, and other authoring semantics.
- `interactionKind`: page-level interaction mode.
- `responseKind`: answer structure for activity cards.
- `capabilityRef`: compute capability for compute panels.

## Migration Policy

Legacy aliases may remain only in a central alias map while a migration change is active. The alias map must identify the canonical class and any variant fields needed to preserve behavior. New authoring and new runtime manifests must use canonical module classes directly.

## Non-Goals

- This change does not implement validation gates.
- This change does not migrate existing lesson manifests.
- This change does not build a visual course editor.

## Risks

- A taxonomy that is too broad would recreate the current open-ended `kind` problem. Keep canonical classes few and move visual or semantic variation into explicit fields.
- A taxonomy that is too narrow would force real compute workspaces into generic cards. Keep `compute.panel` and `activity.workspace` separate.

## Verification

- Validate the OpenSpec change with `openspec validate define-interactive-module-taxonomy --strict`.
- Later changes must use this taxonomy as their source of truth.
