## 1. Node Taxonomy

- [ ] 1.1 Extend ResourceNode type definitions with governed path node semantics for `external_resource`, `checkpoint`, `adaptive_quiz`, `control_workbench`, and `konling`.
- [ ] 1.2 Define display names, icon keys, visual shape hints, and evidence behavior for every path node type in the accepted handoff.
- [ ] 1.3 Update path payload schemas so UI surfaces receive stable node type and icon metadata.

## 2. External Resource Governance

- [ ] 2.1 Add external-resource metadata requirements for title, source, URL, estimated time, knowledge coverage, applicable goal, and evidence-use status.
- [ ] 2.2 Add audit rules that prevent incomplete or unsafe external resources from becoming path-eligible.
- [ ] 2.3 Ensure external-resource completion requires explicit access or interaction evidence before it can affect recommendations.

## 3. Checkpoint Semantics

- [ ] 3.1 Add checkpoint node rules for assessment purpose, passing criteria, evidence references, and remediation behavior.
- [ ] 3.2 Ensure checkpoints are not treated as ordinary content resources or passive views.
- [ ] 3.3 Add fixture paths containing resource nodes and checkpoints.

## 4. Verification

- [ ] 4.1 Add registry tests for all governed node types and required metadata.
- [ ] 4.2 Add audit tests rejecting incomplete external resources.
- [ ] 4.3 Add registry tests proving missing verified render or launch targets are never synthesized and cannot become path-eligible.
- [ ] 4.4 Add path payload tests proving icon semantics are stable across generation, execution, and history views.
- [ ] 4.5 Run `rtk openspec validate govern-adaptive-path-resource-nodes --strict`.
