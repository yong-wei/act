## 1. Classification

- [x] 1.1 Extract resource and simulation warning diagnostics by rule, file, and component kind in `artifacts/react-doctor/classify-resource-simulation-react-doctor-warnings-495/owned-warnings.json` and `classification-report.md`.
- [x] 1.2 Classify R3F/Three `no-unknown-property` findings separately from DOM UI findings; current `domRiskFiles` is empty and all 186 findings remain under `src/resources/simulations/**`.
- [x] 1.3 Create `classification-ledger.json` for scanner-noise findings with owner, evidence, and removal condition.

## 2. Remediation

- [x] 2.1 Fix the high-confidence real resource accessibility findings in the selected batch; two `no-gray-on-colored-background` button contrast findings were removed from the current React Doctor warning evidence.
- [x] 2.2 Do not rewrite R3F scene JSX because no runtime defect was confirmed for the R3F/Three `no-unknown-property` batch.
- [x] 2.3 Add guard tests and evidence for allowlisted R3F/Three findings via `commercial-ui-governance.test.ts`, `classification-ledger.json`, and the simulation visual QA manifest.

## 3. Validation

- [x] 3.1 Attach representative simulation visual/nonblank evidence for the classified simulation scenes from `artifacts/commercial-ui/simulation-experience-visual-qa/manifest.json`.
- [x] 3.2 Confirm classified R3F/Three scanner-noise findings introduce no new console or runtime errors on representative pages using the zero-selected-diagnostic React Doctor error gate.
- [x] 3.3 Record that numerical or metric regression is not required because this change does not touch model, metric, clock, scenario, controller, or physics semantics.
- [x] 3.4 Run resource-focused unit tests for changed widgets and React Doctor classification guards.
- [x] 3.5 Run owned-surface React Doctor warning evidence and report remediated versus classified findings.
- [x] 3.6 Run owned-surface error and Security gates and confirm zero selected diagnostics.
- [x] 3.7 Run `rtk openspec validate classify-resource-simulation-react-doctor-warnings --strict`.
