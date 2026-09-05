## 1. Contract And Wiring

- [ ] 1.1 Add the profile route's governed recommendation read through the Personalization public API for the authenticated student.
- [ ] 1.2 Map recommendation results to the existing personalized resource-card DTO without creating a second recommendation strategy.
- [ ] 1.3 Preserve owner scope, rationale, confidence, evidence window, source coverage, and fallback state at the profile projection boundary.

## 2. Student Experience

- [ ] 2.1 Render governed resource cards in the profile personalized reinforcement section with a real launch action and student-facing evidence explanation.
- [ ] 2.2 Render an honest no-recommendation state with an evidence-gathering or starter-learning action and no fabricated personal claim.

## 3. Verification

- [ ] 3.1 Add route and mapper regressions for eligible recommendations, no usable evidence, recommendation failure, and owner scoping.
- [ ] 3.2 Add browser coverage for `/profile` resource-card rendering, no-recommendation fallback, and launch-route reachability.
- [ ] 3.3 Run focused tests, related personalization/profile tests, typecheck, strict OpenSpec validation, and `git diff --check`.
