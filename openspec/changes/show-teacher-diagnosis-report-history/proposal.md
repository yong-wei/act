# Change: Show governed teacher diagnosis report history

## Why

Issue #1177 follows the governed diagnosis backend delivered by #1137. Teachers can already read authorized class- and student-scoped `DiagnosisReport` records through the API, but the existing teacher workspaces do not expose those persisted reports. Teachers therefore cannot revisit evidence-cutoff snapshots or follow report findings into preparation without calling the API directly.

## What changes

- Add a read-only diagnosis report ledger to the existing teacher class workspace.
- Add the same governed history projection to the existing teacher student-detail workspace.
- Present report summary, findings, evidence coverage, confidence, limitations, risk counts, timestamps, and server-generated preparation links.
- Keep opaque evidence references counted but undisclosed in ordinary UI.
- Add explicit loading, empty, degraded, failure, and responsive states.

## Non-goals

- Triggering or orchestrating report generation.
- Writing or modifying `DiagnosisReport` records.
- Adding a student-facing diagnosis report surface.
- Creating preparation packs or interventions automatically.

## Impact

- Affected capability: `teacher-diagnosis-report-surface`.
- Affected code: diagnosis report API projection, teacher class/student workspaces, and a shared teacher report-history component.
- Commercial UI evidence is required because this change modifies visible teacher workspaces.

