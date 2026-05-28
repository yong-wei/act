## 1. Mapping Contract

- [ ] 1.1 Add SimulationRun mapping requirements for Arena virtual simulation preview creation.
- [ ] 1.2 Preserve ArenaVirtualSimulationRun as the domain detail record with a canonical run reference.
- [ ] 1.3 Define readiness reporting for missing or legacy mappings.

## 2. Provenance Boundaries

- [ ] 2.1 Encode preview visibility, official ineligibility, model relation, dataset hash, controller hash, identification model, and source experiment metadata.
- [ ] 2.2 Ensure official submissions and leaderboard scoring do not consume preview summaries as official scores.
- [ ] 2.3 Preserve owner-user isolation for Arena preview detail joins.

## 3. Consumers

- [ ] 3.1 Update normal consumer contracts to read SimulationRun first.
- [ ] 3.2 Keep Arena-specific pages able to join detail rows for preview rendering.

## 4. Validation

- [ ] 4.1 Add tests for canonical run creation, detail mapping, provenance markers, and cross-user rejection.
- [ ] 4.2 Add tests proving preview results remain separate from official evaluation.
- [ ] 4.3 Run `rtk proxy openspec validate connect-arena-preview-to-simulation-evidence --strict`.
