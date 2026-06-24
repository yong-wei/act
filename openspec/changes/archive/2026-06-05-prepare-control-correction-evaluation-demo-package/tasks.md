## 1. Demo Fixtures

- [x] 1.1 Provide synthetic demo course, class, students, resource nodes, learner-state snapshots, paths, execution logs, simulation/Arena outcomes, citations, and Konling intervention outcomes.
- [x] 1.2 Ensure fixtures are resettable, isolated from production data, and documented with ownership and cleanup rules.
- [x] 1.3 Include provider configuration examples using safe secret references or placeholder values.

## 2. Acceptance Scripts

- [x] 2.1 Add scripts or documented commands that verify learner-state slice generation.
- [x] 2.2 Verify path planning, path read, node execution, deviation, fallback, and terminal validation.
- [x] 2.3 Verify cited Konling coaching and low-confidence fallback behavior.
- [x] 2.4 Verify teacher report metrics, export output, and privacy redaction.
- [x] 2.5 Verify feature flags and rollback behavior for the full loop.

## 3. Documentation Package

- [x] 3.1 Document the demo storyline, expected screenshots or browser route checks, API examples, and report interpretation.
- [x] 3.2 Document deployment, rollback, provider configuration, privacy, audit, and evaluation methodology.
- [x] 3.3 Document final release readiness criteria and known non-goals.

## 4. Verification

- [x] 4.1 Run `rtk openspec validate prepare-control-correction-evaluation-demo-package --strict`.
- [x] 4.2 Run the full demo acceptance script on a local or staged deployment.
- [x] 4.3 Run strict OpenSpec validation for all changes in the series before marking the package accepted.
- [x] 4.4 Verify no demo fixture contains real student data, raw secrets, hidden Arena internals, raw traces, or private Konling memory.
