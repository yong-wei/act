## 1. Composite Preset

- [x] 1.1 Add a composite-control preset module under `src/features/control-workbench/presets/`.
- [x] 1.2 Add a method panel for prefilter, feedforward, local feedback, disturbance compensation, and optional control limits.
- [x] 1.3 Add a structure summary view that mirrors the current parameter draft.

## 2. Artifact And Submission

- [x] 2.1 Build `composite-compensation` artifacts from the current composite draft.
- [x] 2.2 Reuse the unified submission panel and `/api/arena/evaluate`.
- [x] 2.3 Label the first version as parameterized template evaluation where relevant.

## 3. Verification

- [x] 3.1 Add tests for composite draft-to-artifact mapping.
- [x] 3.2 Add tests that `task-third-order-block-diagram` can resolve to the composite preset.
- [x] 3.3 Run targeted Arena controller artifact and workbench tests.
