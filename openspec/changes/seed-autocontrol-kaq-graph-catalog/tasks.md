## 1. Seed Catalog

- [ ] 1.1 Add initial automatic-control knowledge objectives and graph-node bindings.
- [ ] 1.2 Add capability nodes covering all seven portrait v2 dimensions.
- [ ] 1.3 Add quality nodes with scenario, behavior, rubric, and evidence-source metadata.
- [ ] 1.4 Add graph edges for prerequisites, enables, validates, transfers, supports, and tradeoff relations.

## 2. Coverage and Validation

- [ ] 2.1 Prefer existing runtime knowledge-node ids for knowledge bindings.
- [ ] 2.2 Mark partial coverage where a precise runtime node is unavailable.
- [ ] 2.3 Validate that active capability nodes bind to knowledge nodes.
- [ ] 2.4 Validate that active quality nodes are not slogan-only.

## 3. Verification

- [ ] 3.1 Add seed catalog validation tests.
- [ ] 3.2 Add coverage tests against current runtime knowledge ids where feasible.
- [ ] 3.3 Run `rtk openspec validate seed-autocontrol-kaq-graph-catalog --strict`.
