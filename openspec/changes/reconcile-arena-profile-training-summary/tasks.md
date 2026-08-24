## 1. Specification and domain record

- [x] 1.1 Record the evidence vocabulary, filtering decision, and pagination invariant in scoped Grill context and ADR.
- [x] 1.2 Create the OpenSpec proposal, design, delta specification, and implementation checklist.

## 2. Evidence aggregation

- [x] 2.1 Replace raw persisted-row counting with the existing verified training projection.
- [x] 2.2 Paginate the user-scoped candidate scan in one RepeatableRead transaction and retain only the newest five projected rows.
- [x] 2.3 Make direct portfolio aggregation use the same verified projection when no persisted count is supplied.

## 3. Regression and verification

- [x] 3.1 Cover incomplete, damaged, conflicting-boundary, historical, complete, and cross-user runs.
- [x] 3.2 Cover pagination beyond the first 100 candidates and verify the statistics/list口径一致.
- [x] 3.3 Run focused tests, complete TypeScript checks, strict OpenSpec validation, and `git diff --check`; perform the available profile browser smoke. Focused tests, complete typecheck, strict validation, and diff checks pass on the synchronized `integration` base. Profile browser smoke passes at 1440px and 320px with the local PostgreSQL service enabled. The broad `npm run test` gate reaches the smart-courseware suites and Arena smoke checks successfully, then stops on the pre-existing `/knowledge` Commercial UI Evidence SHA mismatch in `artifacts/knowledge-workspace-product-qa-489/browser-evidence.json`; that unrelated path is outside this change.

  - Commercial UI Evidence was captured with `ISSUE_1040_CAPTURE_EVIDENCE=1 npx playwright test tests/arena-training-profile-1040.spec.ts --workers=1` at source checkpoint `904887652a161d4d07fa9322956721524d696633` on 2026-08-10T16:52:19Z. The committed bundle is `artifacts/commercial-ui/issue-1040-arena-training-evidence/manifest.json` plus the three manifest-hashed screenshots for `/profile`; the damaged state is projected as `total=0`, `previewCount=0`, and `recentRuns=[]`, with no training card, count, task title, or quality summary rendered. Capture fails closed on dirty worktrees, source drift, HEAD drift, missing/extra screenshots, hash changes, failed DOM assertions, and horizontal overflow.
