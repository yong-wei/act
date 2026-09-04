## 1. Deterministic cited-evidence rule

- [x] 1.1 Add a validator that pairs cited assignment and assessment refs by student, requires a 14-day time window, and checks score direction.
- [x] 1.2 Reject cross-student mismatch, equal scores, wrong direction, and incomparable timestamps.

## 2. Generation-time guardrail

- [x] 2.1 Run the validator after existing pseudo-conflict checks; failures are retryable model-behavior errors.
- [x] 2.2 Stamp verified conflict reports with a server-owned `conflictEvidenceVerified` flag.

## 3. History projection

- [x] 3.1 Show「证据存在冲突」only for verified comparable conflicts.
- [x] 3.2 Mark unverifiable historical conflict wording as needing regeneration or manual review.

## 4. Regression tests

- [x] 4.1 Cover valid conflict, cross-student mismatch, equal scores, wrong direction, incomparable time window, and historical projection.
