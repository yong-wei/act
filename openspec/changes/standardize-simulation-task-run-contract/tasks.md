## 1. Contracts

- [ ] 1.1 Define SimulationTaskSpec fields, spec hashing, and launch-context attachment.
- [ ] 1.2 Define SimulationRun fields, run kinds, source domain/reference rules, owner scope, and statuses.
- [ ] 1.3 Define SimulationTrace summary/reference/checksum storage rules.

## 2. User Isolation And Access

- [ ] 2.1 Define student owner-only run and trace reads.
- [ ] 2.2 Define teacher class-scoped summary and drilldown access.
- [ ] 2.3 Define admin/audit access without exposing raw traces by default.

## 3. Replay

- [ ] 3.1 Update replay verification design to resolve canonical SimulationRun metadata.
- [ ] 3.2 Add mismatch behavior that reports safely without mutating evidence.

## 4. Validation

- [ ] 4.1 Add contract and access tests for run kinds, source references, and cross-user rejection.
- [ ] 4.2 Add replay verification tests for scoped access and mismatch behavior.
- [ ] 4.3 Run `rtk proxy openspec validate standardize-simulation-task-run-contract --strict`.
