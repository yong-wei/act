## 1. Model Registry

- [x] 1.1 Define registered Arena identification model data shape and persistence strategy without introducing a full ModelOps pipeline.
- [x] 1.2 Create or resolve a registered model from an owned black-box experiment dataset.
- [x] 1.3 Reject preview/submission requests that reference unregistered or mismatched models.

## 2. Adapter Protocol

- [x] 2.1 Expand adapter contracts for public experiment, virtual preview, and official evaluation support.
- [x] 2.2 Add explicit unsupported reasons for unsupported modes.
- [x] 2.3 Preserve official evaluation isolation from preview metrics and payloads.

## 3. Validation

- [x] 3.1 Add route/service tests for registered model ownership, preview use, unsupported adapter modes, and official evaluation isolation.
- [x] 3.2 Run `rtk proxy openspec validate unify-arena-preview-adapter-and-model-registry --strict`.
