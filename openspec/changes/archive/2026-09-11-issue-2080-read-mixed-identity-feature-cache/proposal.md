# Proposal: issue-2080-read-mixed-identity-feature-cache

映射 GitHub Issue: #2080「学习证据缓存将合法的混合知识身份状态误判为过期」。

## Why

写入侧在证据跨知识版本时向缓存写入合法的 `mixed-knowledge-identity` 诊断标记（`student-evidence-feature-cache.ts:553-560`），但读取侧的标记白名单（同文件 `:2423-2433`）未包含该值，导致缓存 round-trip 读取时整体被判为 `stale`（实证复现：混合版本写入后读取 `state: 'stale'`，单版本对照组为 `ready`）。根因是 #1153 在写入侧新增标记时未同步扩展读取白名单，把「跨版本可比性风险」误判为「缓存结构损坏」。同时画像中心的 `normalizeStatusMarkers`（`profile-center.ts:455-466`）会丢弃该标记，画像无法呈现混合身份风险。Issue 报告经代码核查确认属实。

## What Changes

- 扩展读取侧状态标记 schema 白名单，使合法的 `mixed-knowledge-identity` 标记不再单独导致缓存结构校验失败或 `readState=stale`；真正未知的标记值、结构损坏与真实过期保持 fail-closed。
- 画像层保留并透传 `mixed-knowledge-identity` 标记与分版本可比性信息，画像明确展示混合身份与对应风险，不伪装成单一知识版本。
- 补充「写入后再读取」round-trip 回归测试，覆盖单版本、混合版本、未知标记值、真实过期/结构损坏四类场景。
- 用既有重建路径重建受影响学生的特征缓存，核验画像可用性与实际合格证据数一致。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `student-evidence-feature-cache`: 新增需求——合法混合知识身份标记不得单独导致缓存读取失效；缓存须保留跨版本可比性风险标注；未知标记、结构损坏、过期保持 fail-closed。
- `student-evidence-status`: 新增需求——画像证据状态面须保留并展示混合知识身份标记与分版本可比性限制。

## Impact

- 代码：`src/lib/data-governance/student-evidence-feature-cache.ts`（标记白名单）、`src/lib/**/profile-center.ts`（标记透传）、对应测试文件。
- 运维：通过既有缓存重建路径刷新受影响学生缓存，无数据库迁移。
- 依赖关系：与进行中的课程 Runtime 发布加固（`simplify-runtime-cas-publish-activate`）无关、可并行；与 #2084（历史身份审计与隔离）相邻，建议本 change 先行，#2084 的画像分组统计在其后落地。
- 非目标：不改动写入侧标记语义、不改动推荐引擎既有的混合版本 fail-closed 逻辑、不做「标记枚举单一真源」重构（列为可选后续）。
