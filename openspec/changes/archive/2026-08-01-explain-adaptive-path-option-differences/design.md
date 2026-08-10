## Context

`/assessment/adaptive-practice` sends the selected option and another option to `/api/adaptive/path-advisor-tool`. The route resolves public option ids to stored style ids and validates that both belong to the current student's saved path. `buildAdaptivePathTradeoffOutput` currently discards those validated identities and returns two fixed sentences, although the saved `pathPayload` already contains ordered node ids and summaries, effort, resource mix, readiness, checkpoints, locked nodes, terminal validation and limitations.

The comparison must remain server-owned and deterministic. It must not ask a model to infer missing causes, alter path order, or recompute recommendations.

## Goals / Non-Goals

**Goals:**

- Compare exactly two options from the same current saved path.
- Return structured, student-safe facts with stable option and node identities.
- Preserve each option's real node order while deriving common, exclusive and reordered nodes.
- Explain measurable trade-offs without inventing motivations.
- Render the result readably in the option module on desktop and 320px mobile layouts.
- Make stale explanations disappear when the loaded candidate set changes.

**Non-Goals:**

- Change path generation, scoring, policy families, candidate order or selection.
- Add a model-generated prose layer or new recommendation logic.
- Backfill historic path payloads or add database columns.
- Redesign the complete path comparison workspace.

## Decisions

### Build the comparison from the persisted path payload

The runtime will load the scoped `LearningPath` and parse its `policyBundle.paths`, falling back to `pathOptions` under the existing fallback rules. The existing scope and option-id checks remain authoritative.

Alternative considered: compare the client payload. Rejected because client data is not authoritative and can become stale or forged.

### Return structured facts plus a compatibility summary

The runtime result will add a `comparison` object containing status, path id, compared option descriptors, common and option-only nodes, order differences, metrics, trade-offs and limitations. `studentSafeRationale` remains as a concise deterministic summary for existing consumers, but the learning center will render `comparison` directly.

Alternative considered: replace `studentSafeRationale` with one long sentence. Rejected because it is difficult to verify, test and read on narrow screens.

### Treat missing node facts as an explicit non-comparable result

Both options need non-empty ordered node ids and matching student-safe summaries. Missing titles or node types produce `insufficient-data`; identical facts produce `no-material-difference`; otherwise the status is `ready`. All statuses are successful tool results because the request and scope are valid even when comparison evidence is insufficient.

Alternative considered: throw an API error for historic incomplete payloads. Rejected because the page can explain the limitation without treating a valid historic path as a transport failure.

### Derive trade-offs only from measurable deltas

Trade-off sentences will be generated from effort, node count, resource mix, checkpoint count, locked-node count and terminal-validation count. They will not claim that a node repairs a prerequisite or improves readiness unless that statement already exists as a stored fact.

Alternative considered: ask Konling to infer a natural-language explanation. Rejected because it would make the result non-deterministic and could introduce unsupported claims.

### Bind UI state to the candidate-set fingerprint

The page will clear structured explanations whenever the active path id or ordered option/node identities change. This covers regeneration and revision without requiring persistence for transient explanations.

Alternative considered: persist explanations in the database. Rejected because the comparison is deterministic, inexpensive to rebuild and only valid for the current candidate set.

## Risks / Trade-offs

- [Historic payloads may lack complete summaries] → return `insufficient-data` and list the missing facts without inventing labels.
- [Resource type keys are internal identifiers] → render stable stored keys in the first version rather than introduce an unrelated taxonomy mapping.
- [A large path can produce long node lists] → keep the result inside the existing responsive option module with wrapping lists and no fixed-width table.
- [Runtime parsing duplicates some display parsing] → keep the parser local to the server-owned comparison boundary; do not move planner rules into the page.

## Migration Plan

No data migration is required. Deploy the additive runtime response and UI parser together. Rollback restores the previous fixed rationale without changing saved paths.

## Open Questions

None. Issue #1160 fixes the current deterministic comparison boundary only.
