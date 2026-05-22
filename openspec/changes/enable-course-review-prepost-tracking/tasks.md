## 1. Implementation

- [x] 1.1 Implement the shared pre/post review parser.
- [x] 1.2 Refactor teacher review page to use the parser and keep compatibility paths.
- [x] 1.3 Add tests for 5-3 through 5-6, a non-module-5 lesson, and legacy limited evidence.
- [x] 1.4 Run teacher review and data-governance tests.

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
