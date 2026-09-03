## Why

架构 census、charter/deprecation、dependency/fitness、quality、toolchain、QA 和 release trust checks 已分别形成权威输入，但控制面中仍可能存在重复的 identity normalization、receipt projection、privacy filter 和状态判断。多套 validator 或 wrapper 会让同一 dirty/mixed/drifted 输入出现不同结论，尤其可能把观察性检查误当成 release/rollback 安全许可。

本 change 是 M9 的收口变更（C35），依赖 C34 的完整 active tooling inventory。它在既有 architecture/control-plane owner 内删除派生/重复 validator，保持 fail-closed 规则、revision-bound evidence 和 release/rollback 唯一安全 validator；不创建第二套门禁或新的生产 authority。

## What Changes

- 以现有 census、charter/deprecation、dependency/fitness、quality/toolchain、QA 和 release trust validators 的职责清单为真源，去除重复 normalization、alias、wrapper 和不具备独立事实的 projection。
- 统一同一 source commit/tree、schema、receipt、denominator、owner、scope、privacy 和 status 的校验顺序与失败语义；dirty、mixed worktree、tree drift、stale/duplicate receipt、分母不闭合和敏感输出继续 fail closed。
- 保留并明确 release/rollback 的唯一安全 validator；其他 architecture/quality/observation validators 不能生成激活、部署或回滚许可。
- 让 C34 inventory 中的 canonical commands 与控制面 owner 对齐，保留 `verify:commit`、`verify:push`、`typecheck`、tool/test graph 和 release/rollback entrypoint。
- 以 before/after validator replay、冲突/漂移/隐私 fixture、唯一 consumer、无第二 gate、selector 不变和 rollback 证据验证行为保持。

## Capabilities

### New Capabilities

- `architecture-control-plane-simplification`: 规定架构控制面、active trust validator 的单一职责、证据复用、fail-closed 判定和 release/rollback 安全边界。

### Modified Capabilities

None. `modular-domain-dependency-contracts`、`runtime-main-app-compatibility-proof`、`content-knowledge-runtime-release-toolchains` 及现有 quality/release specs 继续拥有各自要求；C35 删除重复实现，不重写上游事实。

## Impact

- 主要范围：`scripts/architecture-census.ts`、`scripts/architecture-charter.ts`、`scripts/architecture-fitness.ts`、`scripts/architecture-closure.ts`、`src/lib/architecture-fitness/**`、`src/lib/architecture-test-commands/**`、release/runtime/knowledge trust validators、package scripts 和测试。
- 前置依赖 C34 `inventory-and-consolidate-active-tooling-cli-surface`；需使用 C0/业务 waves 的稳定 revision-bound evidence。
- 不新增第二套架构控制面、第二套 shell、第二个 trust/release/rollback validator、PlatformSetting、业务事实、数据库迁移、生产 selector 或部署行为。
