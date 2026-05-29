## 1. Taxonomy Definition

- [x] 1.1 Define canonical module class constants and documentation for content, activity, compute, analytics, layout, and legacy adapter classes.
- [x] 1.2 Define the allowed orthogonal fields for presentation, semantic role, response kind, interaction kind, and capability reference.
- [x] 1.3 Create an initial legacy alias table from the current 151 observed `module.kind` values.

## 2. Authoring Rules

- [x] 2.1 Document that new lessons may not introduce unregistered module kinds.
- [x] 2.2 Document that layout terms, course semantics, and answer structures must not be encoded in `module.kind`.

## 3. Verification

- [x] 3.1 Add or update documentation/tests that enumerate the canonical taxonomy.
- [x] 3.2 Run `openspec validate define-interactive-module-taxonomy --strict`.
