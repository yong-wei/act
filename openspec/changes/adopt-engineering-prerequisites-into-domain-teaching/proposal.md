## Why

当前新版领域图默认「教学顺序」几乎没有边：已发布 Teaching Projection 只有 7 条 `PREREQUISITE`，概览两端过滤后只剩系统建模 2 条。这不是未执行，而是 2026-08-13 增量教学语义系列按当时合同故意做成稀疏审核包，并**禁止**从工程先后修推导教学边、允许覆盖不足不阻断。权威图谱中的先后修代表真实知识逻辑，教学顺序必须服从该认知规律，并在稀疏权威骨架上把本领域涉及的权威概念全部串联起来。

## What Changes

- **BREAKING**：废止「不得从工程关系推导教学先修」对先后修族的禁令。工程层 `post-requisite` / 等价先后修谓词 MUST 被采纳为 `ACT_TEACHING` `PREREQUISITE` 骨架，不得改写 Engineering Authority 字节。
- 每个已注册领域的默认 DomainConcept 概览 MUST 在教学先修图上弱连通；孤立概念 MUST fail closed，不得再以 `partial`/`empty` 作为可发布默认教学顺序。
- 在权威先后修骨架上增量补充教学层直接边，把本领域概览涉及的全部权威概念串联起来；补充边保留来源与审核记录，不把传递闭包存成新事实。
- 重物化 domain-default `teachingRelations` 与 coverage，使默认画布画出教学顺序，而不是只靠用户打开工程族。
- 不切换生产 selector，不改 Engineering 谓词真值。

## Capabilities

### New Capabilities

- `domain-teaching-order-coverage`：定义领域概览教学顺序覆盖门禁——权威先后修骨架、教学扩展串联、弱连通与 fail-closed。

### Modified Capabilities

- `incremental-domain-teaching-projection`：领域默认教学覆盖不足不再是可发布的诚实空白；概览教学顺序必须闭合。
- `act-teaching-prerequisites`：允许并要求把工程先后修采纳为教学 `PREREQUISITE` 骨架；禁止仅因缺少单独 ACT 课文证据而丢掉权威先后修。
- `layered-authority-domain-workspace`：默认教学顺序层必须展示已发布教学边；不得再把工程先后修排除在教学顺序之外。

## Impact

影响 Teaching Projection 作者态/组合/激活、domain-fragments、authority-domain-shards 的 domain-default 教学边与 coverage。不改 Engineering JSON 真源、课程 runtime 路由、生产 selector。前端只消费新物化的教学边。
