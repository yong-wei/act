## Context

First-batch teacher report remediation improved representative report and grading states. The remaining problem is discoverability and continuity: class review, history, class analytics, teacher home, and report book surfaces do not share a single report delivery ledger.

## Design

1. Delivery ledger model.
   - A report ledger entry records actor id or role, class, session, lesson, report type, action id, idempotency key, action timestamp, recipient/delivery scope, delivery status, export state, send state, copy-summary state, artifact refs, and student-visible handoff state.
   - Artifact refs and copied summaries are redacted for the delivery audience; internal report JSON, raw evidence, and hidden AI context are not student-safe outputs.
   - Missing context is represented as blocked or degraded, not as a generic link.

2. Teacher surfaces.
   - Classroom review, teacher home, class analytics, history/review routes, and report book surfaces consume the same delivery status.
   - Teacher actions include export/download, send/publish, copy summary, open grading, and create reinforcement request when supported.

3. Product boundaries.
   - Internal review routes are not acceptable teacher delivery endpoints.
   - Report actions must keep class/session context and must not silently drop to a demo-only report.
   - Assistant-effect report slots must degrade when the real report is unavailable; a demo-only report is not a deliverable class report.

4. Verification and audit update.
   - Existing report/grading remediation stays valid.
   - New evidence focuses on discovery, status continuity, and delivery action completion.

## Out Of Scope

- KAQ diagnosis, prep-pack generation, resource baseline work, and path repair.
