## 1. Audit Schema

- [x] 1.1 Define resource field completion audit row types and missing-field codes.
- [x] 1.2 Add completion method and review status enums.
- [x] 1.3 Add version and freshness fields compatible with the `kaq-artifact-versioning` capability.
- [x] 1.4 Add evidence-contract completeness fields covering event source, event type, attempt key, source log id, dedupe key, timestamps, LearningFact policy, confidence, and privacy.
- [x] 1.5 Add review audit fields covering reviewer, role, reviewed time, review batch, reviewed source hash, reviewed version ref, generation tool/model, prompt or manifest hash, confidence, and stale invalidation.

## 2. Inventory Collection

- [x] 2.1 Inventory registered resources and existing ResourceNode projections.
- [x] 2.2 Inventory runtime lesson steps, modules, handouts, and media assets.
- [x] 2.3 Inventory knowledge cards and infographs.
- [x] 2.4 Inventory authoring textbook chapters, figures, captions, and future section candidates.
- [x] 2.5 Inventory quiz, generated-question, simulation, Arena, checkpoint, and external resource candidates.

## 3. Diagnostics

- [x] 3.1 Classify missing fields by path eligibility, grounding eligibility, citation readiness, readiness gating, and mastery evidence risk.
- [x] 3.2 Mark generated or model-assisted fields as provisional until human-confirmed.
- [x] 3.3 Expose graph coverage limitations for missing, provisional, stale, or blocked resource fields.
- [x] 3.4 Include coverage denominator, source window, artifact version, and limitation reason in coverage diagnostics.
- [x] 3.5 Ensure student-facing outputs do not expose internal resource governance gaps.
- [x] 3.6 Write audit artifacts to `course-content/runtime/resource-governance/resource-field-completion-audit.jsonl` and `course-content/runtime/resource-governance/resource-field-completion-summary.json`.

## 4. Verification

- [x] 4.1 Add tests proving provisional metadata cannot create a PlanningUnit.
- [x] 4.2 Add tests proving missing field codes surface in ResourceCoverage diagnostics.
- [x] 4.3 Run `rtk openspec validate resource-field-completion-audit --strict`.
- [x] 4.4 Add snapshot tests for the audit JSON/JSONL schema and resource-family counts.
- [x] 4.5 Add negative tests proving missing evidence contract or non-human-confirmed review state blocks path eligibility and mastery effect.
- [x] 4.6 Run `rtk npm run test:data-governance`.
- [x] 4.7 Run `rtk npm run db:evidence-source-coverage`.
- [x] 4.8 Verify OpenSpec issue dependency metadata with `/Users/YW/Documents/Project/OpenSpec-buddy/skills/openspec-buddy/scripts/verify-issue-relationships.sh` after issue creation.
