## Context

Existing feature-cache specs already require deterministic rebuilds from governed evidence, ResourceNode execution, path feedback, intervention outcomes, and simulation/Arena feature groups. This change makes the path-round records from the prior change a first-class cache source.

## Goals / Non-Goals

**Goals:**

- Define feature groups for path adoption, completion, deviation, fallback, terminal validation, and intervention outcomes.
- Refresh or enqueue a per-student cache refresh after governed path evidence changes.
- Ensure personalization and learner-state consumers use governed features rather than direct raw path scans.
- Emit shared evaluation events with confidence and privacy metadata.

**Non-Goals:**

- Creating teacher report charts.
- Changing planner scoring.
- Treating unreviewed model-authored narrative as high-confidence evidence.

## Decisions

### Decision 1: Path evidence is derived, not raw

Normal consumers should read compact governed features and references. Raw execution details remain audit, debug, migration, or drilldown material.

### Decision 2: Refresh is per affected student

Execution updates for one student must not rewrite unrelated cache entries.

### Decision 3: Idempotency protects metrics

Repeated execute or intervention writes must not double-count adoption, completion, or accepted intervention outcomes.

## Validation

- Feature-cache rebuild tests SHALL prove stable output from unchanged path evidence.
- Event tests SHALL verify shared envelope fields and privacy levels.
- Personalization tests SHALL verify low-confidence and preview-only markers are preserved.
- `rtk openspec validate connect-path-execution-to-evidence-cache --strict` SHALL pass.
