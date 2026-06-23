## 1. Ledger Model And Entry Points

- [ ] 1.1 Define report delivery ledger states and report identity payloads.
- [ ] 1.2 Define ledger fields for actor, action id, idempotency key, timestamp, recipient scope, artifact refs, redaction policy, and student-safe summary boundary.
- [ ] 1.3 Connect teacher home, class analytics, history, classroom review, and report book surfaces to the ledger.
- [ ] 1.4 Replace internal review aggregation exits with teacher-facing delivery destinations.
- [ ] 1.5 Add unavailable/degraded state for demo-only or missing assistant-effect report slots.

## 2. Delivery Actions

- [ ] 2.1 Add status-bearing export/download, send/publish, copy-summary, and grading handoff actions where supported.
- [ ] 2.2 Add redacted artifact references and student-safe copied summaries for delivery actions.
- [ ] 2.3 Add blocked/degraded recovery states for missing report, class, session, or student context.
- [ ] 2.4 Update audit evidence with delivery-ledger finding ids.

## 3. Verification

- [ ] 3.1 Add tests for ledger status consistency, actor/scope/idempotency fields, and redacted artifact refs across teacher surfaces.
- [ ] 3.2 Add browser or route evidence for report delivery actions and mobile report action areas.
- [ ] 3.3 Run `rtk openspec validate audit-remediation-teacher-report-delivery-ledger --strict`.
