## 1. Diagnosis projection

- [ ] 1.1 Replace the cumulative diagnosis fixed-empty evidence references with a student-safe projection of the governed evidence summary.
- [ ] 1.2 Mark cumulative portrait materialization explicitly and separate portrait availability from evidence-detail availability.
- [ ] 1.3 Preserve source coverage, confidence, evidence cutoff and limitations without exposing raw payloads.

## 2. Student presentation

- [ ] 2.1 Ensure the student diagnosis panel does not require a control-correction snapshot for cumulative portrait diagnosis.
- [ ] 2.2 Ensure overview count, claim evidence count and evidence drawer consume the same projected references.
- [ ] 2.3 Show missing or unavailable evidence as an explicit limitation rather than a complete or zero-valued claim.

## 3. Verification

- [ ] 3.1 Add route and projection regressions for evidenced, partially evidenced and unavailable cumulative portraits.
- [ ] 3.2 Add student component regression for status and evidence-count consistency.
- [ ] 3.3 Run focused tests, relevant browser smoke at desktop/mobile widths, typecheck, strict OpenSpec validation and `git diff --check`.
- [ ] 3.4 After implementation is merged, archive this change with `openspec archive surface-cumulative-diagnosis-evidence-refs --yes` and record the archive path in the Issue/PR; the implementer owns that post-merge closure.

