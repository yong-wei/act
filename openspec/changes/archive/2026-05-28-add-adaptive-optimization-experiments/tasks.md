## 1. Optimization

- [x] 1.1 Implement contextual bandit reranking only for local alternatives after feasible paths are generated.
- [x] 1.2 Ensure reranking cannot bypass prerequisite, privacy, availability, teacher, device, or time constraints.
- [x] 1.3 Add tests for bandit scoping and fallback to deterministic ranking.

## 2. Experimentation and Analytics

- [x] 2.1 Add stratified experiment assignment for current recommendation cards, rules+graph path, rules+graph+bandit, and Konling intervention variants.
- [x] 2.2 Add reporting for path adoption, deviation, correction success, explanation clicks, intervention acceptance, 48-hour follow-through, learner-state freshness, source coverage, and low-confidence rate.
- [x] 2.3 Add privacy-safe aggregate exports with sample counts and completeness markers.

## 3. Stage 2 Operations

- [x] 3.1 Add long-term semantic learner memory and strategy memory after privacy audit and Stage 1 intervention outcomes are stable.
- [x] 3.2 Extend teacher ResourceNode management to bulk mapping, policy review, coverage dashboards, and system-owned issue triage.

## 4. Validation

- [x] 4.1 Add tests for experiment stratification, metric attribution, privacy-safe exports, long-term memory privacy, and teacher bulk-management permissions.
- [x] 4.2 Validate with `rtk proxy openspec validate add-adaptive-optimization-experiments --strict`.
