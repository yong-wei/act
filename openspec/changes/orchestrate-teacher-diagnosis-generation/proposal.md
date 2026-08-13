# Change: Orchestrate governed teacher diagnosis generation

## Why

Issue #1178 closes the generation half of the teacher diagnosis workflow established by #1136. The repository can persist and display governed diagnosis reports, but its public write route still accepts a complete factual report body from the browser. There is no durable generation state, idempotency boundary, retry history, or auditable link between a Konling session and the resulting report.

## What changes

- Replace browser-authored report writes with a server-owned diagnosis generation request.
- Add durable class- and student-scoped generation jobs, execution attempts, status reads, and explicit retry.
- Execute the existing Konling `teacher-diagnosis` mode through a dedicated BullMQ worker.
- Freeze the governed evidence cutoff at job creation and validate structured output before persistence.
- Link every successful report to its generation job and retain session, tool, version, timing, and failure audit data.
- Add generation controls and pending, failed, timed-out, and completed states to the existing teacher report history surface.

## Non-goals

- Accepting factual diagnosis report content from the browser.
- Treating client-provided scope or prompt fields as authorization.
- Automatically generating reports on a schedule.
- Automatically creating preparation packs or interventions.
- Adding a student-facing generation entry or a separate assistant portal.

## Impact

- Affected capabilities: `teacher-diagnosis-generation` and `teacher-diagnosis-report-surface`.
- Affected code: Prisma schema and migration, diagnosis persistence, generation API, Konling provider orchestration, BullMQ queue/worker, and teacher report history UI.
- Operational dependency: the existing Redis/BullMQ runtime used by other generation jobs.

