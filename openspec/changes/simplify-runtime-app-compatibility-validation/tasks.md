## 1. Remove compatibility proxies

- [x] 1.1 Remove application-revision equality and application-snapshot proxy checks from Runtime deployment qualification while preserving immutable Runtime source validation.
- [x] 1.2 Remove compatibility-proof creation, revalidation, lifecycle projection, and active-receipt dependency from regular Runtime activation.
- [x] 1.3 Keep historical active receipts readable during transition and stop writing compatibility fields.

## 2. Retain the actual gate

- [x] 2.1 Keep candidate selection fenced by the existing deployed-application readiness, structured Runtime, route, media, textbook, hybrid-index, and knowledge consumer smoke checks and rollback path.
- [x] 2.2 Add focused regressions for a newer application consuming an older Runtime provenance and for consumer-smoke failure preserving the prior active state.

## 3. Verify and deliver

- [x] 3.1 Run targeted Runtime activation, receipt-reader, and deployment-contract tests plus type checks.
- [x] 3.2 Run strict OpenSpec validation and record the scope-specific verification result.
