## Context

`renderInteractiveManifestStep` currently checks a runtime renderer map and shows an error panel when a visible module lacks a renderer. That is useful for rendering but insufficient as a development gate. The gate must fail before runtime and must understand canonical classes, legacy aliases, response-producing modules, and lesson migration state.

## Design

Implement a registry with at least:

- canonical module class;
- renderer key or activity-slot behavior;
- schema or shape descriptor for allowed config;
- migration alias entries;
- whether the class can produce student evidence;
- whether the class is allowed in new authoring.

Add a manifest inventory test that scans every runtime manifest and reports:

- unregistered `module.kind`;
- legacy alias used in a lesson marked migrated;
- activity module without matching response contract;
- compute module without a registered capability reference;
- visible module kinds that cannot resolve to a canonical class or approved migration alias. Component-level renderer coverage remains in the existing manifest runtime rendering tests so this gate can stay separate from client renderer imports.

Keep this gate separate from rendering. Rendering may remain tolerant while migration is underway, but the gate should name every exception explicitly.

## Non-Goals

- Do not migrate all lesson manifests in this change.
- Do not remove legacy aliases in this change.
- Do not replace objective scoring behavior; response standardization is handled separately.

## Risks

- If the first gate is too strict, it will block migration before aliases exist. Start with alias-aware validation and progressively tighten through later migration changes.
- If the gate only checks TypeScript registry keys, it will miss authoring-level misuse. It must inspect manifests directly.

## Verification

- Run the new module registry gate.
- Run `npm run test:course-data-quality-gates`.
- Run focused manifest runtime tests where the registry is consumed.
- Run `openspec validate implement-interactive-module-registry-gates --strict`.
