## 1. Per-phrasing regression gates

- [x] 1.1 Add `konling-implicit-intent-routing-1903.test.ts` loading the frozen 120-case set and computing accuracy, macro-F1, per-class recall, and the confusion matrix separately for standard and implicit phrasings, asserting the issue gates (≥0.80 / ≥0.75 / ≥0.70 / normative ≥0.90) per group.
- [x] 1.2 Assert no fallback class receives more than half of all misclassifications within either phrasing group, and log both group summaries.

## 2. Multi-intent priority contract

- [x] 2.1 Lock the primary-intent priority (normative > formula-derivation > code-debugging > concept-comparison > open-ended-explanation > fact-explanation, default fallback open-ended-explanation) with both sentence-order variants for each adjacent pair.
- [x] 2.2 Keep the `answerIntent` contract and six-intent enum unchanged (no production code change).

## 3. Verification

- [x] 3.1 Run the new tests, the existing 1816/1901 konling intent tests, and `npm run typecheck`; confirm zero new failures.
