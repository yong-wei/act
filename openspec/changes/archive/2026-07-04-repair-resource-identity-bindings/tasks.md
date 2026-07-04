## Tasks

- [x] Task 1: Repair runtime artifact identity.
  Covers: AC-1
  Acceptance: Mapped lesson 1-3 loads or is documented as a reviewed unavailable artifact.
  Evidence: runtime lesson audit and helper output.
  Reviewer Check: Confirm no placeholder JSON hides missing content.

- [x] Task 2: Repair TeachingResource registry identity.
  Covers: AC-2
  Acceptance: Missing and unregistered registry ids are resolved through existing resource registry metadata.
  Evidence: resourceBinding helper output.
  Reviewer Check: Confirm ids point to real registered resources.

- [x] Task 3: Review TeachingResource knowledge bindings.
  Covers: AC-3
  Acceptance: Every TeachingResource has a reviewed graph binding or explicit limitation.
  Evidence: workqueue diff and helper output.
  Reviewer Check: Confirm bindings are semantically justified, not string-matched only.

- [x] Task 4: Validate OpenSpec and resource binding helpers.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec and targeted resource binding tests pass.
  Evidence: `rtk openspec validate repair-resource-identity-bindings --strict` plus helper command.
  Reviewer Check: Confirm this change does not promote path eligibility by itself.

## Validation

- [x] Run `rtk openspec validate repair-resource-identity-bindings --strict`.
- [x] Run the helper or targeted tests named in the task evidence.
- [x] Preserve before/after helper output for independent review.

## Evidence

- Before helper evidence: `/tmp/act-data-completeness-before.clean.json` reported `teachingResourcesMissingRegistry: 7`, `teachingResourcesUnregisteredRegistry: 36`, `teachingResourcesMissingKnowledge: 112`, and `runtimeArtifactErrors: 1`.
- Repair helper evidence: `rtk proxy npm run db:repair-resource-identity-bindings` repaired 7 registry ids and 112 TeachingResource knowledge bindings across two idempotent runs.
- After helper evidence: `/tmp/act-data-completeness-after.clean.json` reported all four #811 counters as `0`.
- Targeted tests: `rtk npm run test:unit -- src/lib/__tests__/resource-node-registry.test.ts src/lib/__tests__/resource-field-completion-audit.test.ts src/lib/data-governance/__tests__/data-completeness-audit.test.ts`.
