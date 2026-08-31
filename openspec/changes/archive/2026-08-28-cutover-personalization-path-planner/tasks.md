## 1. Characterization and contracts

- [x] 1.1 Capture the current HEAD import/call graph for both `src/lib/adaptive-learning-path-planner.ts` and `src/lib/act-prerequisite-path-planner/`, including learning-path, advisor, candidate-batch, Konling and execution/correction callers.
- [x] 1.2 Add characterization fixtures for candidate ordering, eligibility, repairs, terminal validation, explanations, stale revisions and append-only path history.
- [x] 1.3 Verify the reducer and course-plugin predecessors are qualified; record the owner, public API, non-goals and deletion gate in the deprecation ledger.

## 2. Pipeline implementation

- [x] 2.1 Define the `PlanLearningPath` application contract and ports for goal context, candidate discovery, eligibility, ranking, repair, assembly and explanation under the Personalization boundary.
- [x] 2.2 Move or adapt existing canonical contracts without introducing a second path/candidate schema, preserving provenance, privacy, terminal and revision invariants.
- [x] 2.3 Implement deterministic stage orchestration with explicit hard-eligibility versus soft-ranking results and plugin-provided course policy.

## 3. Vertical migration

- [x] 3.1 Migrate `/api/learning-paths/*`, latest/adoption/execute/correction routes and their services to `PlanLearningPath` or its canonical read/write ports.
- [x] 3.2 Migrate `/api/adaptive/path-advisor-*`, candidate-batch APIs, Konling tools and all remaining production callers; keep response adapters at the edge only.
- [x] 3.3 Preserve path revision/concurrency checks, append-only history, candidate provenance and Arena official-evaluator boundaries; do not rewrite historical paths.

## 4. Deletion and governance

- [x] 4.1 Prove zero production imports of the old planner and zero competing assembly/ranking entrypoints at the intended revision.
- [x] 4.2 Delete `src/lib/adaptive-learning-path-planner.ts` and the old `src/lib/act-prerequisite-path-planner/` authority; do not add re-exports or facades.
- [x] 4.3 Update the deprecation/owner ledger with deleted paths, retained adapters and rollback evidence.

## 5. Verification

- [x] 5.1 Add unit tests for each stage, hard/soft separation, plugin absence, deterministic output, no-RL behavior and explanation privacy.
- [x] 5.2 Run API parity, stale revision, concurrent adoption and path-history tests, then the affected Personalization/path domain suites.
- [x] 5.3 Run typecheck, architecture/import checks, `openspec validate cutover-personalization-path-planner --type change --strict` and `git diff --check`; record that no deployment or production activation occurred.
