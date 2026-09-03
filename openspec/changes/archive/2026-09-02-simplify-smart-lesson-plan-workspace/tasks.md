## 1. Characterize the workspace

- [x] 1.1 Map task, course-basis, source, textbook, goal, stage, approval, job, revision, class-context and return-state fields across page, workspace, service and routes.
- [x] 1.2 Run the code-simplification process and record before/after state owners, derivable fields, effects, events, mappers and aliases.
- [x] 1.3 Add characterization/failing tests for task creation, query/filter/archive, source/textbook selection, suggestion confirmation, generation, failure/retry/resume, outline edit/conflict and courseware handoff.

## 2. Simplify around existing owners

- [x] 2.1 Make `src/lib/smart-lesson-plan` the sole source for durable task/draft/job/stage/revision/approval/source identities.
- [x] 2.2 Reuse preparation document editor/save/conflict/return-state contracts for lesson and outline editing.
- [x] 2.3 Remove duplicate local projections, event aliases, polling branches and mappers only after before/after behavior and stale-response tests pass.
- [x] 2.4 Preserve Konling session/confirm semantics, provider correction bound, source hashes/citations, class context, role auth and SSR/AppShell boundaries.

## 3. Verify lifecycle and safety

- [x] 3.1 Add negative tests for forged source/approval/revision/context and stale response overwrites.
- [x] 3.2 Run focused smart-lesson-plan, teacher workspace, smart-prep route, AI suggestion and responsive UI tests.
- [x] 3.3 Run typecheck, lint, `verify:commit`, `verify:push`, diff checks and strict OpenSpec validation.

## 4. Handoff

- [x] 4.1 Record before/after owner map, deleted derived paths and retained adapters/aliases with deletion conditions.
- [x] 4.2 Run `openspec validate simplify-smart-lesson-plan-workspace --type change --strict` before delivery.
