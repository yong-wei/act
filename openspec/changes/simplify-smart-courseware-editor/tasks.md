## 1. Characterize the editor

- [ ] 1.1 Map draft, job, module, review, preview, publication, revision/hash/source-gap and return-state data across page, editor, service and routes.
- [ ] 1.2 Run the code-simplification process and record before/after state owners, derived fields, aliases and reasons each retained boundary exists.
- [ ] 1.3 Add failing/characterization tests for load, edit, save conflict, generation, retry/resume, module regeneration, review, publication, student preview and return-state.

## 2. Remove duplicate state and adapters

- [ ] 2.1 Make the existing smart-courseware domain/service projection the sole source for durable draft, job, revision, hash, source-gap and publication facts.
- [ ] 2.2 Reuse preparation document editor/save coordinator for document fields and conflicts without introducing a second editor/workspace layer.
- [ ] 2.3 Delete redundant component state, mappers, effects and aliases only where before/after tests prove identical behavior and failure semantics.
- [ ] 2.4 Preserve teacher/student projections, publication gates, plan baseline, idempotency, retry/resume, SSR/R3F and role authorization.

## 3. Verify behavior and boundaries

- [ ] 3.1 Add stale response, refresh, navigation, role/privacy, source-gap and publication-receipt regression coverage.
- [ ] 3.2 Run focused courseware unit/route/component tests and 1440px/320px Playwright interaction checks.
- [ ] 3.3 Run typecheck, lint, `verify:commit`, `verify:push`, diff checks and strict OpenSpec validation.

## 4. Handoff

- [ ] 4.1 Record before/after import and state-owner inventory, deleted derived paths and retained compatibility adapters.
- [ ] 4.2 Run `openspec validate simplify-smart-courseware-editor --type change --strict` before delivery.
