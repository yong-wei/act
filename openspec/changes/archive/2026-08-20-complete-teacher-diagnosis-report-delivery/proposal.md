## Why

Persisted diagnosis reports can be reviewed only inside the report-history ledger. Teachers cannot produce a fixed, role-safe delivery artifact or record what action they took from a finding, so the current workflow stops before auditable teaching delivery.

## What Changes

- Add immutable teacher and student-safe report projections bound to a persisted diagnosis report version.
- Add server-authorized detail, print, and deterministic PDF export routes; persist stable artifact identity, content hash, exporter, and export time without generating a new diagnosis or sending it automatically.
- Add a student-safe projection that removes peer distributions, teacher-only notes, opaque evidence references, and internal action data.
- Add safe evidence summaries and links only to authorized existing student, preparation, and registered remediation-resource surfaces.
- Add append-only teacher disposition events for viewed, pending, intervention-arranged, and completed states while keeping disposition separate from evidence-derived risk.
- Extend report history with explicit delivery, recovery, and disposition controls across desktop and mobile layouts.

## Capabilities

### New Capabilities

- `teacher-diagnosis-report-delivery`: Fixed report projections, role-safe PDF delivery, authorized action links, and auditable teacher disposition.

### Modified Capabilities

None.

## Impact

- Adds diagnosis delivery and disposition persistence plus a PostgreSQL migration.
- Adds teacher and student report routes, PDF generation, authorization boundaries, and UI entry points.
- Reuses `DiagnosisReport`, current teacher/class membership authorization, registered `TeachingResource` metadata, and existing preparation/student routes.
- Adds focused unit, route, migration, and browser evidence coverage; no model invocation, automatic report sending, or automatic teaching-object creation.
