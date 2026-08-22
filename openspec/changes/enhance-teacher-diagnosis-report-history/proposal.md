# Change: Enhance teacher diagnosis report history

## Why

The existing teacher report ledger exposes persisted diagnosis snapshots, but its compact entries do not explain scope, evidence coverage, availability, or what changed relative to the immediately preceding compatible report. Teachers must expand entries and interpret internal labels before deciding whether a snapshot is usable.

## What changes

- Enrich each history entry with Chinese scope, included-student, evidence-cutoff, generation, main-weakness, availability, and comparison summaries.
- Project existing governed sources into fixed top-level groups: 作业、测验、学习行为. Unsupported groups remain explicitly unavailable rather than becoming zero coverage.
- Explain confidence and warning states with deterministic coverage and limitation reasons plus a recovery action.
- Compare only an adjacent older report with identical scope and diagnostic structure version; compare stable structured fields, not generated prose.
- Show a visible no-baseline, incompatible-version, or insufficient-structure state when comparison cannot be trusted.

## Non-goals

- Regenerating, editing, or changing persisted diagnosis reports.
- Changing risk rules, portrait accumulation, generation orchestration, or authorization.
- Creating interventions, preparation packs, assignments, or student-facing reports.
- Completing the option, error-cause, or knowledge-node mappings tracked by #1391–#1393.

## Impact

- Affected capability: `teacher-diagnosis-report-surface`.
- Affected code: shared teacher diagnosis report history projection, component, fixtures, and evidence tests.
- The browser surface must retain privacy-safe source summaries and work at desktop and 320px widths.
