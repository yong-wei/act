## Why
Teachers need precise learning diagnosis in the teaching assistant scenario: analyzing student assignments, tests, and learning behavior to identify knowledge weaknesses and generate diagnosis reports.

The existing `role-based-learning-diagnosis` spec defines role-specific diagnosis views but does not cover storage, diagnosis-to-action closure, or the complete teacher workflow in the TA service.

## What Changes
- New lightweight background risk scanner (deterministic rules, produces StudentRiskFlag only)
- New Konling TA diagnosis mode (`teacher-diagnosis`) with 3 diagnosis tools
- New DiagnosisReport persistence model
- Teacher-initiated diagnosis generation via Konling mode
- Diagnosis reports provide directional links to prep workspace (no auto-trigger teaching actions)

## Capabilities
### New
- `teaching-assistant-diagnosis-mode`: Konling TA diagnosis mode with tools, report generation and storage
- `student-risk-scanner`: Lightweight background risk scan pipeline, deterministic rules, produces StudentRiskFlag

### Modified
- `role-based-learning-diagnosis`: Add teacher-initiated diagnosis trigger scenarios
- `konling-agent-runtime`: Register new diagnosis mode and tools

## Impact
- Affects Konling runtime mechanism (new mode + tool set)
- Affects teacher assistant UI (new diagnosis entry)
- New Prisma model DiagnosisReport
- Background risk scanner worker
- Does not modify student-side diagnosis surfaces, class timed aggregation, or confirmed teaching flow boundaries