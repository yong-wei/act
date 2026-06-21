## 1. Learner Overlay

- [x] 1.1 Add learner graph overlay payload types.
- [x] 1.2 Map server-owned learner state and goal slices to graph-node states.
- [x] 1.3 Include score, confidence, evidence count, freshness, recommendation, reason code, evidence window, source coverage, verified citation refs, and limitations.
- [x] 1.4 Distinguish target requirement, observed mastery, resource coverage, and path context in recommendation rationale.
- [x] 1.5 Preserve privacy-safe evidence references only.

## 2. Class Overlay

- [x] 2.1 Add class graph overlay payload types.
- [x] 2.2 Aggregate authorized class distributions by graph node.
- [x] 2.3 Include confidence, common issue codes, denominator, included population, excluded population, suppression reason, and rounding policy.
- [x] 2.4 Suppress, bucket, or mark unavailable low-denominator graph-node distributions.
- [x] 2.5 Enforce student, teacher, and administrator scope rules.

## 3. Graph Center Modes

- [x] 3.1 Add learner mode with explicit empty and low-confidence states.
- [x] 3.2 Add class heatmap mode for authorized teacher/admin contexts.
- [x] 3.3 Ensure overlay states use text labels in addition to color.

## 4. Verification

- [x] 4.1 Add learner-state mapping tests.
- [x] 4.2 Add recommendation rationale tests for reason code, source coverage, evidence window, and verified citation refs.
- [x] 4.3 Add class aggregation, authorization, denominator, rounding, and small-sample suppression tests.
- [x] 4.4 Add graph-center mode tests for empty, authorized, low-confidence, and suppressed states.
- [x] 4.5 Run `rtk openspec validate add-learner-class-graph-overlays --strict`.
