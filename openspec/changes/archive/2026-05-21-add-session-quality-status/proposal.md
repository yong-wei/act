## Why

Sync incident governance and session reports exist, but teachers and operators still need a simple decision about whether a class session is trustworthy for post-class diagnosis.

## What Changes

- Add a session-quality-status module that returns green, yellow, or red with reasons and metrics.
- Use durable submission coverage, rich/partial ratio, legacy/missing ratio, report freshness, snapshot freshness, and sync severity.
- Add status to session data-quality reports and class report governance summaries.
- Prepare teacher and admin surfaces to consume the status.

## Capabilities

### New Capabilities

- `session-quality-status`

### Modified Capabilities

- None.

## Impact

- src/lib/data-governance/session-quality-status.ts
- src/lib/data-governance/session-data-quality-report.ts
- src/lib/data-governance/session-reports.ts
- teacher/admin APIs
