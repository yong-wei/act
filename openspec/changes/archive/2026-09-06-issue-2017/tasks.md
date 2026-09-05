## 1. Whitelist enforcement

- [x] 1.1 Add the deterministic citation-number whitelist executor reusing existing code-range and technical-index judgments.
- [x] 1.2 Wire the executor into the fair-experiment runner before freezing full-feature answers.
- [x] 1.3 Add regressions for number drift, duplicate markers, technical indexes and no-available-source cases.

## 2. Coverage repair

- [x] 2.1 Compute required/covered units with the same scan semantics as the audit.
- [x] 2.2 Apply one bounded repair that downgrades uncovered claims explicitly without fabricating citations.
- [x] 2.3 Keep normative verification-required semantics: missing citations never become verified authority.

## 3. Verification

- [ ] 3.1 Run focused tests, typecheck, strict OpenSpec validation and `git diff --check`.
