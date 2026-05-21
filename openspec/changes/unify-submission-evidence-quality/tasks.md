## 1. Implementation

- [ ] 1.1 Create src/lib/data-governance/submission-evidence-quality.ts with summary and count helpers.
- [ ] 1.2 Migrate event ingestion, session report, session data-quality report, and backfill classification calls.
- [ ] 1.3 Add unit tests for rich objective, subjective partial, parameter partial, manifest missing, legacy, final-state enriched, and unrecoverable legacy payloads.
- [ ] 1.4 Run npm run test:course-data-quality-gates and the targeted data-governance tests.

## 2. Tests

- [ ] 2.1 Add focused tests for the behavior described in the spec scenarios.
- [ ] 2.2 Include at least one regression fixture from the 5-1, 5-2, or 5-3 to 5-6 investigation when the change touches course evidence.

## 3. Verification

- [ ] 3.1 Run the targeted tests for this change.
- [ ] 3.2 Run `npm run test:course-data-quality-gates` when submission gates, evidence quality, or course specs are touched.
- [ ] 3.3 Run `npm run lint` before handing off implementation.

## 4. Coordination

- [ ] 4.1 Confirm dependency issues are complete before applying this change.
- [ ] 4.2 Update the issue with validation notes and any data-quality caveats.
