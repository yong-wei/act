## 1. Response Registry

- [x] 1.1 Define canonical response kind constants and alias normalization.
- [x] 1.2 Update manifest normalization to expose canonical response kind while preserving legacy source data when needed.
- [x] 1.3 Document which response kinds are objective, subjective, parameter, simulation, or training evidence.

## 2. Evidence and Scoring

- [x] 2.1 Align submission telemetry with canonical response kinds.
- [x] 2.2 Ensure objective scoring covers canonical multi-choice, ordering, and matching kinds.
- [x] 2.3 Preserve explicit unsupported-scoring metadata for subjective or underspecified responses.

## 3. Verification

- [x] 3.1 Add tests for alias normalization and canonical response classification.
- [x] 3.2 Add tests for structural partial-credit scoring.
- [x] 3.3 Run `npm run test:course-data-quality-gates`.
- [x] 3.4 Run `openspec validate standardize-interactive-response-contracts --strict`.
