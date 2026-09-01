## 1. Registration inventory

- [ ] 1.1 Enumerate manifest plugin sets, exact keys, central kind branches,
  compatibility exports, and all course-local `InteractiveModuleRegistry`
  entries.
- [ ] 1.2 Characterize ordinary, activity, compute, visual, layout, role,
  required-missing, optional-missing, and versioned renderer behavior.
- [ ] 1.3 Classify each registration as reusable-plugin, course-owned-local,
  duplicate, shadow, or legacy with an owner and replacement.

## 2. Canonical registration and lookup

- [ ] 2.1 Migrate reusable capabilities to existing owned `ManifestPluginSet`
  composition without changing keys or contract versions.
- [ ] 2.2 Route central rendering through exact plugin lookup and prohibit
  declared capabilities from falling through to legacy branches.
- [ ] 2.3 Preserve role projection, evidence behavior, missing-renderer policy,
  generated-courseware markers, and student-safe payloads.
- [ ] 2.4 Keep justified course-local registries explicit and non-shadowing;
  record their rationale in the inventory.

## 3. Retire the legacy renderer

- [ ] 3.1 Re-run production, test, dynamic, and bundle import inventories for
  old renderer branches and compatibility entrypoints.
- [ ] 3.2 Delete legacy branches and exports only after zero required callers;
  do not leave a forwarding facade or second global registry.
- [ ] 3.3 Hand the canonical renderer to C14 with characterization and
  deletion evidence.

## 4. Verification and handoff

- [ ] 4.1 Run focused plugin registry, module gate, role projection, evidence,
  optional/missing, and generated-courseware tests.
- [ ] 4.2 Run affected Interactive tests, typecheck, lint, build, strict
  validation, and `git diff --check`.
- [ ] 4.3 Record the registration inventory, behavior comparison, deletion
  proof, and remaining non-blocking local registries.
