## 1. Telemetry Model

- [ ] 1.1 Define sync incident key fields and burst window constants.
- [ ] 1.2 Add recovery telemetry for successful polling after prior failures.
- [ ] 1.3 Preserve raw fetch diagnostic fields inside incident payloads.

## 2. Client Emission

- [ ] 2.1 Aggregate repeated session progress failures.
- [ ] 2.2 Aggregate repeated session state failures.
- [ ] 2.3 Suppress non-timeout abort noise unless persistent.
- [ ] 2.4 Keep HTTP failures and sustained timeouts visible.

## 3. Reports

- [ ] 3.1 Extend session reports with raw error count, incident count, severity, dominant source, and affected users.
- [ ] 3.2 Distinguish hidden-tab or aborted transient failures from unresolved classroom incidents.

## 4. Verification

- [ ] 4.1 Add fetch diagnostics unit tests.
- [ ] 4.2 Add session report tests for incident aggregation.
- [ ] 4.3 Run targeted session-framework and data-governance tests.
- [ ] 4.4 Run `npm run lint`.
