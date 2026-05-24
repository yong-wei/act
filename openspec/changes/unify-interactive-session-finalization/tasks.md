## 1. Adapter Rewrite

- [ ] 1.1 Define the final standard finalization adapter input contract.
- [ ] 1.2 Move telemetry assembly and closure phase orchestration into the shared adapter.
- [ ] 1.3 Delete or replace `buildSessionFinalizeTelemetry` instead of preserving it as a wrapped legacy path.

## 2. Course Migration

- [ ] 2.1 Migrate standard course finalizers for 2-1 through 5-6 to the shared adapter.
- [ ] 2.2 Remove course-local `trackSessionFinalize(buildSessionFinalizeTelemetry(...))` logic.
- [ ] 2.3 Keep teacher session finish outcomes and quality-status reporting equivalent or better.

## 3. Gates And Tests

- [ ] 3.1 Expand finalization guards from module 5 to the full standard course inventory.
- [ ] 3.2 Add regression tests for successful and partially failed finalization phases.
- [ ] 3.3 Add a negative fixture proving handwritten finalization bypasses fail the guard.

## 4. Verification

- [ ] 4.1 Run finalization unit tests.
- [ ] 4.2 Run `npm run test:course-data-quality-gates`.
- [ ] 4.3 Run `npm run lint`.
