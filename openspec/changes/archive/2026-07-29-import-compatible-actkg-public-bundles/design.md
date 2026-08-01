## Context

#1125 已在 PR #1128 中完成并归档：CTKG 0.2 聚合包已按固定合同事务导入，Repository、候选图谱和候选态控灵已经切换到该 ReleaseSet。该实现的固定版本常量、精确适配器和回归计数是历史接入证据，不应被改写成通用协议。

`establish-actkg-public-bundle-compatibility` 负责把标准公开包验证为与存储无关的 `ValidatedActKGBundle`。本变更只负责将该结果无损持久化为显式候选 ReleaseSet，并让现有 Repository 按持久化合同读取它。候选图谱、节点详情和控灵继续消费既有 Repository/API，不直接读取 Bundle。

## Goals / Non-Goals

**Goals:**

- 保留 #1125 的数据、回执和精确适配器，同时新增标准 Bundle 的候选导入路径。
- 对标准包实现事务、幂等、原始字节往返和失败关闭。
- 将 Bundle、Release、ReleaseSet、Projection 与 Artifact 身份完整落库。
- 让 Repository 验证显式候选时使用其持久化合同和回执，而不是固定 v0.2 常量。

**Non-Goals:**

- 不修改知识图谱 API、DTO、图谱画布、节点详情或控灵工具合同。
- 不自动移动默认候选、active 或 Legacy selector。
- 不计算 ReleaseSet Delta，不执行课程覆盖、资源绑定或消费者迁移。
- 不把工程关系解释为教学关系，不重建 ActKG 私有数据。

## Decisions

1. **标准导入只消费验证结果。** 新入口接收 `ValidatedActKGBundle`，不得再次扫描目录、拼接文件名或重新解释 Manifest。这样兼容判断与数据库写入只有一条明确边界。#1125 的精确入口继续使用其冻结适配器，不改写历史调用。
2. **Bundle Receipt 与语义 Release 分离。** Bundle 修订、Manifest 和 Artifact 原始字节按 Bundle 身份保存；对象、关系和 Crosswalk 按 Release 语义身份保存。同一 Release/hash 的新包装修订不得复制语义行。
3. **一次事务完成 Stage。** Bundle Receipt、Artifact、Release、组件引用、全部 Projection 摘要、runtime 投影对象/关系、Link Metadata、Crosswalk 和统计在一个事务中写入。唯一性冲突、组件/身份不一致或重复内容不一致时整体回滚。
4. **Round Trip 先于候选接受。** 事务内 Stage 完成后，从持久化数据重建全部公开 Artifact 和 runtime 语义集合，与验证输入逐字节、逐身份和逐计数比较。只有通过后才写入不可变 `ACCEPTED_CANDIDATE` 回执。
5. **显式候选与默认候选分开。** 导入成功使 ReleaseSet 可被授权治理流程按 ID 查询，但不移动当前默认候选指针。后续 Delta、课程/资源治理和验收完成后，既有切换流程再决定是否更新默认候选。
6. **Repository 依据持久化合同诊断。** v0.2 历史候选继续执行 #1125 的精确诊断；标准候选使用 Bundle/Schema/Artifact 合同身份、导入回执和 Projection digest 诊断。Repository 不从文件回退，也不把一个候选的行、缓存或诊断混入另一个候选。
7. **多 Projection 原样保存，单 runtime 映射。** 每个 Projection 的 profile、ID、digest、原始字节和计数独立保存；只有验证结果选定的 runtime profile 映射到现有 `act.canvas.v2`、`act.node-detail.v2` 和 `act.migration-review.v1` 基础数据。domain/review 不因内容相同而合并。
8. **运行接口保持兼容。** 现有 DTO 已携带 ReleaseSet、Release 与 Projection 身份，图谱端也已支持未知类型/谓词的原文只读显示。因此本变更不建立新的前端或控灵变更；仅补齐后端对标准候选的持久化和显式读取。

## Risks / Trade-offs

- [新表字段与 #1125 数据不完整对应] → 新字段允许历史行显式缺省，并以协议种类选择精确历史诊断或标准诊断；不回填虚构 Bundle 身份。
- [包装修订与语义更新被混淆] → 以 Release ID/hash、source dataset hash 和语义 Artifact digest 联合判定；冲突失败关闭。
- [Round Trip 增加导入耗时] → 导入属于离线受控操作，优先保证公开包可重建和事务完整性。
- [多个候选同时存在] → 所有查询、缓存、回执和后续治理输入必须显式绑定 ReleaseSet 与 Projection digest，不引入“最新版本”选择。

## Migration Plan

1. 在不改写 #1125 表行的前提下增加 Bundle/Artifact/Projection 元数据和唯一性约束。
2. 将标准导入命令接到 `ValidatedActKGBundle`，保留 v0.2 精确命令与测试。
3. 用 v0.3 包装修订验证包装幂等，用合成 v0.4 验证语义更新和多 Projection。
4. 完成事务失败、并发重复导入、逐字节往返、显式候选 Repository 查询和 Legacy 隔离测试。
5. 部署迁移后先导入标准夹具为非默认候选；若失败，回滚数据库迁移并继续使用 #1125 候选。

## Open Questions

无。默认候选何时切换由后续治理和切换变更决定，不属于本变更。
