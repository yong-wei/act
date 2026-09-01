## 1. Reproduce forged provenance

- [ ] 1.1 Add a route/browser regression showing arbitrary URL `source`, `assignment` and `intent` values can currently become immutable saved provenance.
- [ ] 1.2 Inventory every platform entry point that creates a portfolio-reflection candidate and identify its server-owned source identity.

## 2. Establish the provenance trust boundary

- [ ] 2.1 Define the minimum source identity and provenance classification for platform-verified and student-provided reflections.
- [ ] 2.2 Resolve canonical platform fields and learner authorization on the server before model execution and draft creation.
- [ ] 2.3 Preserve free reflection through explicitly labeled student-provided fields without presenting them as verified sources.
- [ ] 2.4 Keep saved provenance immutable while allowing only draft content edits and preserving discard/idempotency behavior.

## 3. Verify compatibility and auditability

- [ ] 3.1 Prove forged URL display text cannot create platform-verified provenance or access another learner's source.
- [ ] 3.2 Prove valid platform entry points save canonical provenance and survive refresh unchanged.
- [ ] 3.3 Prove free reflection remains available with a visible student-provided classification and no formal learning-state writeback.
- [ ] 3.4 Run focused task-boundary, draft route/database and browser tests, typecheck, strict change and repository OpenSpec validation, and `git diff --check`.

