## 1. Courseware generation

- [ ] 1.1 Add persistence and APIs for teacher-private courseware drafts, generation stages, module lineage, source bindings, and approved-plan baselines.
- [ ] 1.2 Implement progressive generation from an immutable approved plan into the shared BOPPPS slide-runtime schema.
- [ ] 1.3 Reuse durable provider/job semantics for one active job, partial completion, resume, retry, cancellation, idempotency, and production provider enforcement.

## 2. Activities and evidence

- [ ] 2.1 Enforce executable activity coverage for pre-assessment, participatory learning, and post-assessment.
- [ ] 2.2 Validate objective answers, explanations, scoring and open-activity learner outputs and teacher review points through canonical response contracts.
- [ ] 2.3 Persist verified module citation bindings, canonical source states, stable module-gap identities bound to content/source hashes and the courseware-authoring lineage root, and platform-owned citation metadata without accepting model-authored verified links or creating acknowledgements; retain draft revisions only as audit context.
- [ ] 2.4 Implement immutable AI-generated, AI-generated then teacher-edited, and teacher-created provenance transitions.

## 3. Editor and role views

- [ ] 3.1 Build step/module add, edit, delete, reorder, registered resize, layout switch, and slot reassignment against shared validation.
- [ ] 3.2 Implement selected-module-only regeneration with scoped context, diff acceptance, and guards against sibling, timing, or plan mutation.
- [ ] 3.3 Build teacher and student previews from the same manifest with answer, review-point, citation-audit, provider, and model-metadata separation.
- [ ] 3.4 Add stale-plan notice after plan updates without blocking preview or forcing regeneration.
- [ ] 3.5 Add generation, activity, citation, canonical source-state, gap-id stability/change/delete-recreate, no-implicit-acknowledgement, provenance, role-access, privacy, editor, regeneration, typecheck, and strict OpenSpec tests; record AC evidence.
