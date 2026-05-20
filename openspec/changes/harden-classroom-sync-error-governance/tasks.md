## 1. Telemetry Model

- [x] 1.1 Define sync incident key fields and burst window constants.
- [x] 1.2 Add recovery telemetry for successful polling after prior failures.
- [x] 1.3 Preserve raw fetch diagnostic fields inside incident payloads.

## 2. Client Emission

- [x] 2.1 Aggregate repeated session progress failures.
- [x] 2.2 Aggregate repeated session state failures.
- [x] 2.3 Suppress non-timeout abort noise unless persistent.
- [x] 2.4 Keep HTTP failures and sustained timeouts visible.

## 3. Reports

- [x] 3.1 Extend session reports with raw error count, incident count, severity, dominant source, and affected users.
- [x] 3.2 Distinguish hidden-tab or aborted transient failures from unresolved classroom incidents.

## 4. Verification

- [x] 4.1 Add fetch diagnostics unit tests.
- [x] 4.2 Add session report tests for incident aggregation.
- [x] 4.3 Run targeted session-framework and data-governance tests.
- [x] 4.4 Run `npm run lint`.
