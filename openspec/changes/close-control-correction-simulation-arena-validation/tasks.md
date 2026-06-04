## 1. Terminal Validation Contract

- [ ] 1.1 Define path terminal validation states for simulation and Arena outcomes.
- [ ] 1.2 Define policy fields for must-include-simulation, must-end-with-Arena, preview allowance, replay confidence, and official evidence requirement.
- [ ] 1.3 Map validation outcomes to path completion, failure, fallback, and low-confidence states.

## 2. Evidence Consumption

- [ ] 2.1 Consume governed SimulationRun, Arena preview, official submission, replay, and summary references without redefining trace or scoring semantics.
- [ ] 2.2 Preserve preview/official provenance and hidden official evaluation boundaries.
- [ ] 2.3 Provide Konling with privacy-safe failure context and citation references.

## 3. Verification

- [ ] 3.1 Add tests for successful validation through simulation plus Arena.
- [ ] 3.2 Add tests for repeated simulation failure and fallback activation.
- [ ] 3.3 Add tests for invalid Arena submission, preview-only evidence, and missing replay confidence.
- [ ] 3.4 Add tests that hidden Arena internals and raw traces are not exposed through path or Konling payloads.
- [ ] 3.5 Run `rtk openspec validate close-control-correction-simulation-arena-validation --strict`.
- [ ] 3.6 Run focused planner, simulation/Arena evidence, and Konling tests.
