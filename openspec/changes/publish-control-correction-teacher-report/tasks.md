## 1. Report Contract

- [ ] 1.1 Define cohort metrics for path adoption, completion, deviation, competency lift, simulation pass rate, Arena valid submission rate, Konling intervention acceptance, intervention-after-success, citation coverage, and resource contribution.
- [ ] 1.2 Define metric denominator, window, confidence, and exclusion metadata.
- [ ] 1.3 Define student drilldown payload with scoped evidence summaries and references.

## 2. API And Export

- [ ] 2.1 Add or extend teacher adaptive-report API for `goal=control-correction`.
- [ ] 2.2 Add export behavior for review-ready tables and chart data.
- [ ] 2.3 Preserve existing class insight behavior and feature-flag fallback.

## 3. Verification

- [ ] 3.1 Add API tests for authorized teacher access, forbidden cross-class access, metric calculation, and drilldown redaction.
- [ ] 3.2 Add tests for missing, stale, partial, and low-confidence evidence.
- [ ] 3.3 Add export tests that validate required sheets or payload sections and metric methodology notes.
- [ ] 3.4 Run `rtk openspec validate publish-control-correction-teacher-report --strict`.
- [ ] 3.5 Run focused teacher insight, data-governance, and report/export tests.
