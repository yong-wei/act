## Why

The audit found many pages where URL parameters, filters, pagination, bad IDs, and API results disagree. This creates false normal states: no-match searches return real users, missing paths show progress, and deep links silently redirect away from the user task.

## What Changes

- Establish a route/query/API interpretation contract for audited `q`, `role`, `page`, `returnTo`, `assignment`, `riskId`, `gradingRunId`, `pathId`, `lessonId`, and source parameters.
- Require UI and API no-match, bad-object, unauthorized, and unsupported-method states to agree.
- Add product recovery states for bad IDs instead of default 404s, silent redirects, or normal-looking pages.
- Tie each closed contract mismatch back to the audit chapter and evidence.

## Capabilities

### New Capabilities
- `audit-remediation-api-ui-contracts`: audit remediation contract for route parameters, filter semantics, bad-object recovery, and API/UI consistency.

### Modified Capabilities
- None. Existing domain specs keep their business rules; this capability records the cross-domain audit contract.

## Impact

- Affects student evidence, learning paths, missions, admin users, data governance, teacher reports, grading workbench, class-student links, and bad-ID pages.
- Evidence references include `chapters/52-function-state-flows-batch44.md`, `chapters/53-function-state-flows-batch45.md`, and `chapters/63` through `67`.
