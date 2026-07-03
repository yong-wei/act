## 1. Review Contract

- [ ] 1.1 Define required semantic fields and review audit fields for assessment items.
- [ ] 1.2 Define review packet format for catalog items and candidate semantic suggestions.
- [ ] 1.3 Define rules that prevent script-only semantic inference from marking items reviewed.

## 2. Review Workflow

- [ ] 2.1 Implement or document review packet generation for all catalog source families.
- [ ] 2.2 Implement reviewed snapshot ingestion or registration with reviewer audit fields.
- [ ] 2.3 Report stale review decisions when source content hashes change.
- [ ] 2.4 Report rejected, deprecated, and blocked items without dropping them from catalog totals.

## 3. Gates And Tests

- [ ] 3.1 Extend data-quality gates with assessment item semantic coverage checks.
- [ ] 3.2 Add tests for missing fields, invalid objective ids, stale source hash, and script-only review rejection.
- [ ] 3.3 Run `rtk openspec validate add-assessment-item-semantic-review-workflow --strict`.
- [ ] 3.4 Run targeted semantic review workflow tests.
