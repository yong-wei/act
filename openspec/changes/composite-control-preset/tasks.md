## 1. Composite Preset

- [ ] 1.1 Add a composite-control preset module under `src/features/control-workbench/presets/`.
- [ ] 1.2 Add a method panel for prefilter, feedforward, local feedback, disturbance compensation, and optional control limits.
- [ ] 1.3 Add a structure summary view that mirrors the current parameter draft.

## 2. Artifact And Submission

- [ ] 2.1 Build `composite-compensation` artifacts from the current composite draft.
- [ ] 2.2 Reuse the unified submission panel and `/api/arena/evaluate`.
- [ ] 2.3 Label the first version as parameterized template evaluation where relevant.

## 3. Verification

- [ ] 3.1 Add tests for composite draft-to-artifact mapping.
- [ ] 3.2 Add tests that `task-third-order-block-diagram` can resolve to the composite preset.
- [ ] 3.3 Run targeted Arena controller artifact and workbench tests.
