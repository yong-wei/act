## 1. Contract Structure

- [x] 1.1 Add `src/features/control-workbench/contracts/` and a stable `index.ts` export.
- [x] 1.2 Add `targets.ts`, `nominal-model.ts`, `signals.ts`, `views.ts`, `methods.ts`, `layout.ts`, `controller-draft.ts`, `artifact-bridge.ts`, and `session-context.ts`.
- [x] 1.3 Ensure contract files import only stable Arena domain types and do not import React, Prisma, API routes, stores, workers, or chart modules.

## 2. Core Types

- [x] 2.1 Define `WorkbenchMode`, `WorkbenchSessionContext`, `WorkbenchExperimentPolicy`, and `WorkbenchSubmissionPolicy`.
- [x] 2.2 Define `WorkbenchPlantTarget` with white-box transfer-function support and black-box hidden-target support.
- [x] 2.3 Define `NominalModelArtifact` with source object, source dataset hash, representation, validation metrics, and timestamp fields.
- [x] 2.4 Define `WorkbenchSignalKind` and `WorkbenchSignal` with source-aware signal provenance.
- [x] 2.5 Define `WorkbenchViewId`, `WorkbenchViewConfig`, `WorkbenchPresetId`, `WorkbenchLayoutPreset`, and method panel identifiers.
- [x] 2.6 Define `ControllerDraft`, draft validation state, and `ArtifactBridgeResult`.

## 3. Pure Helpers

- [x] 3.1 Add helper functions for converting a white-box Arena object into a `WorkbenchPlantTarget`.
- [x] 3.2 Add helper functions for representing black-box objects without exposing transfer-function data.
- [x] 3.3 Add helper functions or constants for default submission policies in challenge, assignment, explore, and Odyssey contexts.

## 4. Tests And Guards

- [x] 4.1 Add unit/type tests covering white-box, black-box, and free-explore contract examples.
- [x] 4.2 Add a boundary test that contract files do not import React, Prisma, API routes, persistence stores, workers, or chart modules.
- [x] 4.3 Add tests proving `ControllerDraft` converts to an official artifact only through a bridge result shape.
- [x] 4.4 Run targeted tests and `rtk npm run lint`.
