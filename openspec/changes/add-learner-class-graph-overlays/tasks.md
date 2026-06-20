## 1. Learner Overlay

- [ ] 1.1 Add learner graph overlay payload types.
- [ ] 1.2 Map server-owned learner state and goal slices to graph-node states.
- [ ] 1.3 Include score, confidence, evidence count, freshness, recommendation, reason code, evidence window, source coverage, verified citation refs, and limitations.
- [ ] 1.4 Distinguish target requirement, observed mastery, resource coverage, and path context in recommendation rationale.
- [ ] 1.5 Preserve privacy-safe evidence references only.

## 2. Class Overlay

- [ ] 2.1 Add class graph overlay payload types.
- [ ] 2.2 Aggregate authorized class distributions by graph node.
- [ ] 2.3 Include confidence, common issue codes, denominator, included population, excluded population, suppression reason, and rounding policy.
- [ ] 2.4 Suppress, bucket, or mark unavailable low-denominator graph-node distributions.
- [ ] 2.5 Enforce student, teacher, and administrator scope rules.

## 3. Graph Center Modes

- [ ] 3.1 Add learner mode with explicit empty and low-confidence states.
- [ ] 3.2 Add class heatmap mode for authorized teacher/admin contexts.
- [ ] 3.3 Ensure overlay states use text labels in addition to color.

## 4. Verification

- [ ] 4.1 Add learner-state mapping tests.
- [ ] 4.2 Add recommendation rationale tests for reason code, source coverage, evidence window, and verified citation refs.
- [ ] 4.3 Add class aggregation, authorization, denominator, rounding, and small-sample suppression tests.
- [ ] 4.4 Add graph-center mode tests for empty, authorized, low-confidence, and suppressed states.
- [ ] 4.5 Run `rtk openspec validate add-learner-class-graph-overlays --strict`.
