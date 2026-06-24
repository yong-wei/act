## 1. Loop Contract

- [ ] 1.1 Define graph-aware class diagnosis payloads with LearningGoal, graph node, overlay, ResourceCoverage, citation, evidence, and version refs.
- [ ] 1.2 Define prep-pack candidate payloads targeting K/A/Q graph nodes and resource coverage gaps.
- [ ] 1.3 Add limitation and suppression handling for low denominator, missing evidence, stale overlay, and missing resources.

## 2. Surface Integration

- [ ] 2.1 Connect Graph Center teacher actions to class diagnosis and prep-pack entry.
- [ ] 2.2 Connect diagnosis weak nodes and resource gaps to prep-pack draft generation.
- [ ] 2.3 Preserve teacher review, preview, activation, rollback, and runtime overlay boundaries.

## 3. Verification

- [ ] 3.1 Add tests for graph-node diagnosis payloads.
- [ ] 3.2 Add tests for prep-pack candidates linked to graph nodes and resource gaps.
- [ ] 3.3 Add tests that low denominator and private evidence remain privacy-safe.
- [ ] 3.4 Add an E2E or route-level demo path from GraphCenter to diagnosis to prep-pack review.
- [ ] 3.5 Run `rtk openspec validate connect-kaq-diagnosis-preppack-loop --strict`.
