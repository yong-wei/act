## Tasks

- [ ] Task 1: Repair runtime artifact identity.
  Covers: AC-1
  Acceptance: Mapped lesson 1-3 loads or is documented as a reviewed unavailable artifact.
  Evidence: runtime lesson audit and helper output.
  Reviewer Check: Confirm no placeholder JSON hides missing content.

- [ ] Task 2: Repair TeachingResource registry identity.
  Covers: AC-2
  Acceptance: Missing and unregistered registry ids are resolved through existing resource registry metadata.
  Evidence: resourceBinding helper output.
  Reviewer Check: Confirm ids point to real registered resources.

- [ ] Task 3: Review TeachingResource knowledge bindings.
  Covers: AC-3
  Acceptance: Every TeachingResource has a reviewed graph binding or explicit limitation.
  Evidence: workqueue diff and helper output.
  Reviewer Check: Confirm bindings are semantically justified, not string-matched only.

- [ ] Task 4: Validate OpenSpec and resource binding helpers.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec and targeted resource binding tests pass.
  Evidence: `rtk openspec validate repair-resource-identity-bindings --strict` plus helper command.
  Reviewer Check: Confirm this change does not promote path eligibility by itself.

## Validation

- [ ] Run `rtk openspec validate repair-resource-identity-bindings --strict`.
- [ ] Run the helper or targeted tests named in the task evidence.
- [ ] Preserve before/after helper output for independent review.
