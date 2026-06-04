## 1. Terminal Validation Contract

- [x] 1.1 Define path terminal validation states for simulation and Arena outcomes.
- [x] 1.2 Define policy fields for must-include-simulation, must-end-with-Arena, preview allowance, replay confidence, and official evidence requirement.
- [x] 1.3 Map validation outcomes to path completion, failure, fallback, and low-confidence states.

## 2. Evidence Consumption

- [x] 2.1 Consume governed SimulationRun, Arena preview, official submission, replay, and summary references without redefining trace or scoring semantics.
- [x] 2.2 Preserve preview/official provenance and hidden official evaluation boundaries.
- [x] 2.3 Provide Konling with privacy-safe failure context and citation references.

## 3. Verification

- [x] 3.1 Add tests for successful validation through simulation plus Arena.
- [x] 3.2 Add tests for repeated simulation failure and fallback activation.
- [x] 3.3 Add tests for invalid Arena submission, preview-only evidence, and missing replay confidence.
- [x] 3.4 Add tests that hidden Arena internals and raw traces are not exposed through path or Konling payloads.
- [x] 3.5 Run `rtk openspec validate close-control-correction-simulation-arena-validation --strict`.
- [x] 3.6 Run focused planner, simulation/Arena evidence, and Konling tests.
