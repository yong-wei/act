## Why

Arena black-box flow currently has a useful public experiment, preview, and hidden evaluation skeleton, but the nominal model reference is effectively derived on the client from a dataset hash. A platform-grade loop needs a server-owned model registry and a clearer adapter contract.

## What Changes

- Introduce registered identification model artifacts derived from owned public experiment datasets.
- Require preview and submission flows to reference server-owned registered model ids.
- Expand the Arena adapter protocol across public experiment, virtual preview, and official evaluation support.
- Preserve the preview-versus-official evaluation separation.

## Capabilities

### New Capabilities
- `arena-model-registry-preview-adapters`: Defines server-owned model registration and adapter support rules for Arena public experiments, previews, and official evaluations.

### Modified Capabilities
- `arena-blackbox-adapter-boundary`: Tighten production adapter behavior so model registration and preview support are explicit.
- `control-workbench-blackbox-identification`: Move authoritative nominal model identity from client construction to server-owned registered model artifacts.

## Impact

- Affects `src/features/arena/blackbox/**`, `src/features/arena/adapters/**`, workbench black-box identification UI, and Arena persistence.
- Depends on protocol standardization and evidence governance.
- This is not a research-grade ModelOps or training-pipeline change.
