## Why

`createManifestContentModuleRegistry` 仍包含 68 个历史别名 handler，当前课程只直接调用其中 13 个。32 份 runtime manifest 的 1,488 个模块均已使用 canonical kind，55 个旧分发表项可以删除。

## What Changes

- 删除中心 registry 中无实际调用的 55 个旧 alias handler，预计减少约 121 行、55 个分支。
- 保留仍被课程私有 registry 调用的 13 个 handler，以及规范化/拒绝旧 manifest 所需的 taxonomy alias 和 `payload.legacyKind`。
- 删除或修改仅要求旧 handler 存在的测试，验证当前课程、插件精确查找和缺失 renderer 行为。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `course-renderer-registration-retirement`: 删除无实际消费者的旧分支，失效测试不成为保留理由，以现有测试和变更说明验证。

## Impact

主要修改 `src/features/interactive/shared/manifest-runtime/content-renderers.tsx` 及相关测试。不新增 registry、组件框架或依赖，不改课程展示和作答流程。
