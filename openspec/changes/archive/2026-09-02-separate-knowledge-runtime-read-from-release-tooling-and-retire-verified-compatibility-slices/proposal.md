## Why

Knowledge runtime reads and knowledge/runtime publication tools currently share `src/lib` authorities, historical compatibility registries and cutover helpers. This makes a student/teacher read path understand release history and leaves compatibility slices alive without a proven consumer. C21 separates the read graph from build/release tooling and retires only slices with revision-bound zero-consumer evidence.

## What Changes

- Establish a one-way boundary: product/runtime readers consume the existing active read contracts and generated runtime artifacts; they do not import release, qualify, publish, cutover or rollback writers.
- Keep content export, Authority/Teaching Projection build, Runtime Release publication, activation and rollback in independently runnable tooling graphs.
- Inventory v1/v2/v022 and other knowledge compatibility slices, retain only those with real migration/rollback consumers, and delete verified zero-consumer slices with receipts and a tested rollback commit.
- Preserve active/hash/rollback identity, role isolation, candidate-versus-production separation, and fail-closed behavior for drifted artifacts.

## Capabilities

### New Capabilities

- `knowledge-runtime-read-release-separation`: Defines the read/build/release dependency boundary and evidence-gated retirement of knowledge compatibility slices.

### Modified Capabilities

None. Existing `content-knowledge-runtime-release-toolchains`, `oss-runtime-release-management`, `oss-runtime-deployment-bridge`, Authority, shard and projection specifications remain the authoritative contracts consumed by this change.

## Dependency and Boundary

本变更为 C21，属于 M5，必须等待现有 active Authority graph G 系列六项完成或明确解除阻塞：

- `activate-v037-bilingual-authority-graph`（locale）
- `consolidate-active-authority-graph-controls`（controls）
- `render-authority-formulas-on-graph-canvas`（formula）
- `restore-active-authority-force-runtime-parity`（force）
- `verify-active-authority-graph-parity`（parity）
- `adopt-active-authority-knowledge-workspace`（workspace）

本 change 不改变 Authority selector、domain shard、ActKG schema、Teaching Projection schema 或 production Authority；它只约束代码依赖和工具调用方向。

## Impact

- Runtime read side: `src/app/api/knowledge/`、`src/features/knowledge/`、`src/lib/authoritative-knowledge/`、`src/lib/authority-domain-*`、resource index/eligibility readers。
- Tool side: `scripts/actkg-release/`、`scripts/knowledge-cutover/`、runtime publication/qualification commands and their tests.
- Compatibility candidates: v1/v2/v022 bundle registries, display projections and other entries in the architecture deprecation ledger.
- No product selector, shard payload, schema, production Authority, database migration or release activation is included.
