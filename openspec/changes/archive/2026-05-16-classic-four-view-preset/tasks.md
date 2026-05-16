## 1. Preset Extraction

- [x] 1.1 Add a classic preset module under `src/features/control-workbench/presets/`.
- [x] 1.2 Extract or wrap the current multi-representation model hook for use inside the unified shell.
- [x] 1.3 Extract or wrap the four-view chart grid and correction drawer without changing numerical behavior.

## 2. Unified Route Integration

- [x] 2.1 Route white-box `multi-representation-linkage` preset requests to the classic preset inside the control workbench.
- [x] 2.2 Preserve the old multi-representation route as a wrapper or legacy alias.
- [x] 2.3 Keep incompatible task handling fail-closed and Chinese.

## 3. Verification

- [x] 3.1 Add tests that `task-second-order-lead-pid` renders through the new preset.
- [x] 3.2 Add tests that the old route remains available.
- [x] 3.3 Run existing multi-representation artifact mapper and analysis tests.
