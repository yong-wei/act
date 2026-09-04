## 1. Baseline

- [x] 1.1 Confirm no active change owns the runtime, then record current size, direct domain imports, public exports, and compatibility branches.
- [x] 1.2 Run the existing Konling runtime tests for tools, context, citations, sessions, permissions, persistence, and failures.

## 2. Simplification

- [x] 2.1 Simplify tool metadata, context projection, citation handling, domain adapters, and run-state plumbing one boundary at a time.
- [x] 2.2 Remove obsolete compatibility and forwarding code after proving zero use; keep domain decisions in existing public APIs.

## 3. Verification

- [x] 3.1 Run Konling tests, related chat route tests, `npm run typecheck`, `npm run test`, and `git diff --check`.
- [x] 3.2 Report before/after size, direct domain imports, guards, state forms, compatibility branches, and unchanged public behavior.

Baseline (claim HEAD `6b390df84`): `konling-agent-runtime.ts` 10637 lines / 425913 bytes. Knowledge/path-planning/interventions public-api each imported 2–3 times. Local `isStudyQuestionIntent` duplicated `konling-study-question-structure`. Unused `ai-tools` tool objects (`getSimulationStatusTool`/`setSimulationParamsTool`/`analyzeResultTool`) still imported after scoped-tool migration. Mode aliases `teacher-grading-assistant`/`student-feedback-explainer` kept (tests still cover them). Direct implementation imports (`teacher-resource-node-data`, `frequency-response-resource-seed`, `goal-subgraph-expansion-service`, `arena-companion-context`) kept because no matching public API.

After: 10621 lines / 425050 bytes. One import each for knowledge, path-planning, and interventions public-api. Study-question identity/sections use the existing catalog. Legacy tool objects no longer imported. Public behavior unchanged (264 focused runtime tests passed). `konling-smart-prep-route-binding` 9 failures are pre-existing on claim HEAD (mock missing `resolveInteractiveLessonRegistryKey`).
