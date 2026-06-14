## 1. Classification

- [ ] 1.1 Extract resource and simulation warning diagnostics by rule, file, and component kind.
- [ ] 1.2 Classify R3F/Three `no-unknown-property` findings separately from DOM UI findings.
- [ ] 1.3 Create an exception ledger for scanner-noise findings with owner and removal condition.

## 2. Remediation

- [ ] 2.1 Fix real resource accessibility and state/effect warnings in the selected batch.
- [ ] 2.2 Do not rewrite R3F scene JSX unless there is a confirmed runtime defect.
- [ ] 2.3 Add guard tests or evidence for any allowlisted R3F/Three findings.

## 3. Validation

- [ ] 3.1 Run representative simulation visual/nonblank checks for touched simulation scenes.
- [ ] 3.2 Confirm classified R3F/Three scanner-noise findings introduce no new console or runtime errors on representative pages.
- [ ] 3.3 Run numerical or metric regression tests whenever touched code affects model, metric, clock, scenario, controller, or physics semantics.
- [ ] 3.4 Run resource-focused unit tests for changed widgets or charts.
- [ ] 3.5 Run owned-surface React Doctor warning evidence and report remediated versus classified findings.
- [ ] 3.6 Run owned-surface error and Security gates and confirm zero selected diagnostics.
- [ ] 3.7 Run `rtk openspec validate classify-resource-simulation-react-doctor-warnings --strict`.
