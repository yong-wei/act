## 1. AI Surface Contracts

- [x] 1.1 Define task type, context policy, output target, and writeback behavior for audited AI surfaces.
- [x] 1.2 Add sanitization for student-visible AI context and citation diagnostics.
- [x] 1.3 Fix focus priority between Global AI, page-local AI, Prompt inputs, and task controls.

## 2. Durable Outputs

- [x] 2.1 Implement report-feedback AI task candidates and adopt/discard/pending-writeback states.
- [x] 2.2 Implement portfolio reflection draft/candidate creation.
- [x] 2.3 Add Prompt evaluation completion, demo/history boundary, stop/retry/clear, and status states.

## 3. Verification And Audit Ledger

- [x] 3.1 Verify no raw server context or diagnostic JSON appears in student-visible AI answers.
- [x] 3.2 Run `rtk openspec validate audit-remediation-ai-task-boundaries --strict`.
- [x] 3.3 Update only verified AI/Prompt/Copilot audit findings with evidence links.
