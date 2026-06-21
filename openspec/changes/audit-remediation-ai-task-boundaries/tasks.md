## 1. AI Surface Contracts

- [ ] 1.1 Define task type, context policy, output target, and writeback behavior for audited AI surfaces.
- [ ] 1.2 Add sanitization for student-visible AI context and citation diagnostics.
- [ ] 1.3 Fix focus priority between Global AI, page-local AI, Prompt inputs, and task controls.

## 2. Durable Outputs

- [ ] 2.1 Implement report-feedback AI task candidates and adopt/discard/writeback states.
- [ ] 2.2 Implement portfolio reflection draft/candidate creation.
- [ ] 2.3 Add Prompt evaluation completion, demo/history boundary, stop/retry/clear, and status states.

## 3. Verification And Audit Ledger

- [ ] 3.1 Verify no raw server context or diagnostic JSON appears in student-visible AI answers.
- [ ] 3.2 Run `rtk openspec validate audit-remediation-ai-task-boundaries --strict`.
- [ ] 3.3 Update only verified AI/Prompt/Copilot audit findings with evidence links.
