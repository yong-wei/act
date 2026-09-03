## 1. Server Prompt Boundary

- [ ] 1.1 Separate the model-only Evidence Copilot projection from navigation metadata and prevent raw `source`, `assignment`, and `intent` values from entering the private system prompt.
- [ ] 1.2 Preserve server-authorized evidence status, limitations, source coverage, confidence, freshness, weak targets, next action, advisory-only rules, and ordinary Copilot behavior.
- [ ] 1.3 Keep bounded parsing and control-character rejection fail closed before model execution; do not add keyword filtering.

## 2. Regression Coverage

- [ ] 2.1 Update unit tests to prove instruction-shaped and delimiter-shaped navigation hints are absent from the generated model prompt while server evidence remains present.
- [ ] 2.2 Add route-level coverage that inspects the model invocation, rejects control-character descriptors before generation, and confirms invalid requests do not call the model.
- [ ] 2.3 Add or update browser acceptance for `/ai/copilot?context=evidence` with arbitrary descriptors, verifying the page remains usable and descriptors do not appear as factual student evidence.

## 3. Verification And Delivery Evidence

- [ ] 3.1 Run focused Evidence Copilot tests, related AI Chat route tests, and the applicable TypeScript checks.
- [ ] 3.2 Run `openspec validate guard-evidence-copilot-navigation-boundary --type change --strict`, relevant repository strict validation, and `git diff --check`.
- [ ] 3.3 Capture any required desktop/320px Evidence Copilot browser evidence from a clean, revision-bound checkpoint and record the verification result in the delivery record.
