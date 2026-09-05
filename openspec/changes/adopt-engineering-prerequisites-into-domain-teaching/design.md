## Context

2026-08-13 增量教学语义系列已经落地：`enable-incremental-domain-teaching-projection` 与 foundation/classical/modern/cross-domain 四个审核包。当时合同明确：只发已审核的直接教学边；**禁止从工程关系推导先修**；覆盖不足不阻断。结果当前 composed teaching overlay 只有 7 条 `PREREQUISITE`，domain-default 两端过滤后默认画布只剩系统建模 2 条。工程 family shard 里仍有大量先后修与其他关系，但默认 `enabledFamilies=[]`，用户看到「教学顺序没有关系」。

权威先后修是知识逻辑真源。教学顺序必须服从它，并在稀疏骨架上把每个领域默认概览涉及的 DomainConcept 全部串联。

## Goals / Non-Goals

**Goals:**

- 把工程 `post-requisite` 族采纳为 `ACT_TEACHING` `PREREQUISITE` 骨架，带工程关系 id 溯源。
- 每个注册领域的默认 DomainConcept 概览在教学先修图上弱连通。
- 用教学层直接边补骨架缺口，不把传递闭包存成新事实。
- 重物化 domain-default `teachingRelations`，默认教学顺序层可见。

**Non-Goals:**

- 不改写 Engineering Authority 字节或谓词。
- 不在运行时从工程边推断教学边。
- 不要求 7476 个次类型对象全部进入默认概览。
- 不切换生产 selector、不 `deploy:runtime`。
- 不在本变更修复卡/资源身份或 hover/过滤 UI。

## Decisions

1. **涉及节点 = 领域默认概览 DomainConcept**  
   与 domain-default 画布一致。次类型仍走搜索/一跳。备选（全部 catalog 成员）会把公式/陈述拉进默认图，拒绝。

2. **构建期采纳，运行时不推断**  
   物化/组合时把工程先后修写成教学边。工作区仍只画已发布 `ACT_TEACHING` 边。这样默认层有边，且不破坏「工程族需显式打开」。

3. **只采纳 post-requisite 族**  
   与旧版教学顺序默认族对齐。`association` / `derived_from` / `has_component` 仍不得直接变成教学先修。

4. **扩展边是教学层直接边**  
   在不反向权威先后修的前提下，按课次目标、主 COVERS 绑定和领域目录顺序补边，使概览弱连通。扩展边 `RECOMMENDED` 或带 `extension` 来源；权威骨架 `REQUIRED`。REQUIRED 子图保持无环。

5. **跨域工程先后修**  
   保留在 composed teaching 中供一跳/边界使用；不因跨域而丢掉。默认领域画布仍只画两端都在本概览的边。

6. **覆盖门禁**  
   任一注册领域概览存在未覆盖孤立 DomainConcept 则候选投影 fail closed。废止「该领域默认教学顺序可以 empty/partial 仍发布」。

## Risks / Trade-offs

- [扩展边引入认知错误] → 扩展边必须可追溯、不得反向权威骨架；REQUIRED 无环校验失败则整包拒绝。
- [概览节点数大，弱连通需要很多扩展边] → 允许星形或生成树，不要求哈密顿路。
- [与 2026-08-13 增量包字节冲突] → 新投影版本组合，不改已封印 fragment 字节；新 fragment 声明采纳与扩展。

## Migration Plan

作者态生成新 domain-fragments → 组合新 projection → 本地物化 domain-default → 验证 15 领域弱连通与默认画布边数。生产切换另授权。回滚：保留旧 composed pointer。

## Open Questions

无。次类型不进默认教学顺序已在 Goals 固定。
