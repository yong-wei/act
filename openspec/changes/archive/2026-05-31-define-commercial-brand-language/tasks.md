## 1. Brand Foundation

- [x] 1.1 Document the brand metaphor, logo direction, color roles, typography stack, texture rules, and motion rules.
- [x] 1.2 Map current UI anti-patterns to replacement rules for homepage, Arena, workbench, adaptive learning, profile, teacher/admin, and course runtime.
- [x] 1.3 Define how commercial brand tokens extend or override existing platform token names.
- [x] 1.4 Define icon family, stroke weight, imagery, texture, and brand-asset usage rules.

## 2. Asset and Application Contract

- [x] 2.1 Define required brand applications: favicon, nav logo, course badge, Arena badge, report watermark, and data center snapshot treatment.
- [x] 2.2 Define visual acceptance checks for trace, loop, instrument, and evidence motifs.
- [x] 2.3 Define which existing shells may be removed instead of adapted during later migration.
- [x] 2.4 Define login/auth, teacher/admin governance, and report application references so downstream work shares the same visual world.

## 3. Validation

- [x] 3.1 Validate with `rtk proxy openspec validate define-commercial-brand-language --strict`.
- [x] 3.2 Review the contract against the current homepage, `/arena`, `/interactive-learning`, `/assessment/adaptive-practice`, and `/interactive-learning/control-workbench`.
- [x] 3.3 Review the contract against `/login?callbackUrl=%2Fprofile`, representative teacher/admin workspaces, and report output use cases.
