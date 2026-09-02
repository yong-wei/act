## 1. Inventory and reproduce exposure

- [x] 1.1 Confirm all production and test consumers of `/api/ai/konling-context` and document whether any student UI requires a public field.
- [x] 1.2 Add an authenticated raw-response regression containing canaries in learner, plan, workspace, teaching, provenance, memory, tool and missing-context structures.

## 2. Enforce a student-safe endpoint boundary

- [x] 2.1 Retire the complete browser-readable runtime DTO when no production consumer exists.
- [x] 2.2 If a consumer is required, define a separate allowlisted student projection using product language and exclude private memory, internal provenance, tool permissions, raw diagnostics and identifiers.
- [x] 2.3 Move test/debug introspection to service-owned builders or restricted diagnostics instead of the student endpoint.

## 3. Verify compatibility and confidentiality

- [x] 3.1 Prove authenticated student responses contain none of the internal canary values or field families.
- [x] 3.2 Prove server-side model grounding still receives the governed context required for supported Konling modes.
- [x] 3.3 Run focused Konling route/runtime tests, typecheck, strict change and repository OpenSpec validation, and `git diff --check`.

