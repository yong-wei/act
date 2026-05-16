## Why

`docs/arenav3.1.md` defines the next Arena and comprehensive workbench work as parallel development: Arena remains the official evaluation and record system, while the comprehensive control workbench becomes the design, simulation, identification, preview, and submission entry. A small shared contract change is needed first so the Arena branch and workbench branch do not each invent incompatible context, signal, view, draft, and artifact types.

## What Changes

- Add a pure TypeScript contract layer under `src/features/control-workbench/contracts/`.
- Define shared types for workbench session context, official target, nominal model, signals, view configs, method panels, layout presets, controller drafts, experiment policy, submission policy, and artifact bridge results.
- Add pure conversion helpers for deriving workbench target/session fields from existing Arena domain data without changing runtime behavior.
- Add minimal type-level/unit tests proving the contracts are importable from client-safe code and can represent white-box, black-box, and free-explore boundaries.
- Place this change before the existing unified workbench shell, preset, routing, and Arena backend upgrade changes.

## Capabilities

### New Capabilities
- `control-workbench-contracts`: Defines the shared contract layer that lets Arena and comprehensive control workbench development proceed in parallel without coupling UI, evaluation, or persistence implementation.

### Modified Capabilities

## Impact

- New files under `src/features/control-workbench/contracts/`.
- New targeted tests under `src/features/control-workbench/__tests__/` or an equivalent local test directory.
- Reuses existing Arena types from `src/features/arena/types.ts`; does not change Arena seed data, evaluator behavior, Prisma schema, API routes, or React workbench UI.
- Later OpenSpec changes should consume these contracts instead of redefining session context, target/model, signals, view configs, or controller drafts.
