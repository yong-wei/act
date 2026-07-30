## Why

The teaching-assistant runtime lacks a governed backend path for class-scoped learning diagnosis. Teachers need deterministic risk signals, privacy-safe diagnosis tools, and durable reports before a user interface can safely expose the workflow.

## What Changes

- Add a paged background scanner for the current `constraint`, `stagnation`, and `cross_domain` risk types.
- Register a teacher-only `teacher-diagnosis` Konling mode with three class-scoped, privacy-safe evidence tools.
- Persist class and student diagnosis reports with explicit class, creator, target, evidence-cutoff, coverage, confidence, and evidence-reference fields.
- Add an authorized read/write API for diagnosis reports.
- Add preparation links to report findings that reference a knowledge node.

## Capabilities

### New

- `teaching-assistant-diagnosis-mode`: governed teacher diagnosis runtime and report persistence boundary.
- `student-risk-scanner`: deterministic, paged current-risk scan pipeline.

## Impact

- Affects the Konling runtime tool registry and worker scheduler.
- Adds the `DiagnosisReport` schema and migration.
- Adds a teacher-only diagnosis-report API.
- Does not add the teacher dashboard entry or report-rendering UI; those require a separate frontend change.
- Does not modify student diagnosis surfaces or trigger teaching actions automatically.
