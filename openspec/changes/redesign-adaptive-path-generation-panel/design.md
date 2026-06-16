## Context

The Product Design handoff shows path generation as a focused task panel, while the current implementation mixes generation, current path, goals, and history in one long page. The generation controls are not truly editable and the natural-language input does not drive the path-generation request. This change owns the panel and option bundle, while readiness gates and execution results are handled by sibling changes.

## Goals / Non-Goals

**Goals:**

- Provide a desktop panel and mobile sheet for path generation.
- Make every required field a real control with defaults and validation.
- Send structured parameters to `generate_learning_path` or its governed Konling wrapper.
- Render comparable path options that are selectable, adjustable, rejectable, and explainable.

**Non-Goals:**

- Implementing heavy-node readiness rules; that is owned by `govern-adaptive-path-readiness-gates`.
- Implementing complex-node result records; that is owned by `complete-adaptive-path-execution-results`.
- Redesigning unrelated adaptive practice question flows.

## Decisions

- The generation panel is a path task panel, not the global chat sidebar. Konling may assist through path-advisor tools, but the form remains the source of structured parameters.
- The request contract includes `goalId`, `timeBudgetMinutes`, `difficultyRhythm`, `resourcePreference`, `checkpointPreference`, `allowExternalResources`, `naturalLanguageIntent`, `excludedNodeIds`, `preferredStyleId`, and `requestedAt`.
- The option bundle presents three distinct choices when possible. In low-resource cases, a slot may include locked or preparation-first nodes, but it must not be a cosmetic duplicate.
- Visual acceptance compares generated screenshots against the Product Design concept images and records the evidence path in the QA artifact.

## Risks / Trade-offs

- Planner output may not initially contain every comparison field. Mitigation: add a mapper that fails visibly in development and renders honest unavailable states in production.
- Too many controls can slow first use. Mitigation: defaults are prefilled and the primary action remains a single `生成路径` button.
- Natural-language intent could leak raw text into logs. Mitigation: continue using existing redaction and input-summary contracts for AgentToolRun.
