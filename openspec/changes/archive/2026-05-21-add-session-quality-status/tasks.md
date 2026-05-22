## 1. Implementation

- [x] 1.1 Implement session-quality-status.ts with thresholds and reason codes.
- [x] 1.2 Wire status into session data-quality report and class report data.
- [x] 1.3 Add green, yellow, and red fixture tests.
- [x] 1.4 Run npm run db:session-data-quality -- --json --compact and targeted tests.

## 2. Tests

- [x] 2.1 Add focused tests for the behavior described in the spec scenarios.
- [x] 2.2 Include at least one regression fixture from the 5-1, 5-2, or 5-3 to 5-6 investigation when the change touches course evidence.

## 3. Verification

- [x] 3.1 Run the targeted tests for this change.
- [x] 3.2 Run `npm run test:course-data-quality-gates` when submission gates, evidence quality, or course specs are touched.
- [x] 3.3 Run `npm run lint` before handing off implementation.

## 4. Coordination

- [x] 4.1 Confirm dependency issues are complete before applying this change.
- [x] 4.2 Update the issue with validation notes and any data-quality caveats.
