## Context

ACT 资源用途和 ActKG 来源证据具有不同权威。现有资源绑定旧节点数组，不能作为 Canonical 迁移依据，也不具备增量审核和版本身份。

## Goals / Non-Goals

**Goals:**

- 建立来源 Crosswalk 与教学角色绑定两个清晰层次。
- 以变化端触发的增量流程处理节点和资源变化。
- 让有效教学资源在切换前形成可审核 Canonical 身份。

**Non-Goals:**

- 不把 ACT 教学角色写回 Engineering Release。
- 不为草稿、停用、归档或非教学资产建立阻断门槛。
- 不让候选生成模型批准自己的绑定。

## Decisions

1. Crosswalk 以来源身份、EvidenceSegment identity、版本和内容哈希定位 ACT 原子片段。
2. 绑定实体记录 Canonical revision、资源片段 hash、教学角色、来源、审核状态和提示词版本。
3. 节点变化查询资源索引，资源变化查询 Canonical 索引；相同候选对合同支撑双向增量。
4. 唯一 EvidenceSegment 与唯一资源类型角色同时成立时可确定性发布。
5. 其他候选由隔离上下文 GPT 审核；争议、高影响和结论冲突进入人工队列，结构门禁始终有效。
6. 最终门禁只统计当前有效、可推荐、可入路径或可产生证据的原子资源。
7. 绑定发布状态与生产消费 selector 分离；前者可以在候选阶段完成，后者在最终一次性切换前保持 Legacy。

## Implemented Shadow Boundary

当前持久化 Release 只有 `automatic-control-root-locus-coverage-v1@1` 的一个
CourseCoverage Canonical Object，数据库中不存在 EvidenceSegment 到 ACT structural
unit 的 Crosswalk。因此本变更只建立可运行的影子机制，不生成任何推断绑定，也不宣称
Canonical cutover ready。

资源清单以同一个 `captureRevision`、`capturedAt` 和 PostgreSQL WAL watermark 捕获
TeachingResource、LessonItem placement、resource registry 与 runtime resource
projection observation。无实质 override 的 LessonItem 只作为 TeachingResource 的
placement reference 聚合；有实质 override 的 placement 才形成独立原子身份。生成课件
资源聚合 TeachingResource、LessonItem 与 LessonPlan 的 publication revision identity；
多 revision 冲突进入 unresolved。每个原子资源必须归入
`INCLUDED`、`EXCLUDED` 或 `UNRESOLVED`：

- `published`、`recommendable`、`pathEligible`、`evidenceProducing` 或
  `currentlyDelivered` 的明确正向信号进入 denominator；
- `draft`、`disabled`、`archived`、`auditOnly` 或 `nonTeaching` 才能排除；
- 默认 availability、合成 instrumentation、teacher-only 和 finished-only 不构成排除
  或正向证明；
- source unavailable、缺少 disposition、捕获冲突和原子身份冲突均为 unresolved。

Runtime projection 的 source hash 同时接受 bare SHA-256 与 `sha256:` 前缀。缺少
`lifecycleScope` 不表示 source unavailable，`lifecycleScope=runtime` 也不推断
published。当前路径资格要求目标可定位、无 blocker、human-confirmed audit 且 reviewed
hash 与 source hash 一致；证据信号要求完整 evidence contract。

清单可以在所有 observation 已逐项分类后标记 complete，但本 change 不提供 authority
激活操作，`cutoverReady` 恒为 false。正式推荐、路径和证据消费者始终选择 Legacy；
Canonical binding 只允许 `SHADOW_AUDIT` 读取。

Inventory 的逻辑 identity 由 capture revision 与资源语义投影决定；`capturedAt` 和 WAL
watermark 只保存在首次成功 capture receipt，不进入 observation digest、source hash 或
run ID。同 revision 的部署重试和并发导入通过事务级 advisory lock 复用同一 run；资源
内容或 source hash 改变仍产生新 run。

## Candidate, Review, and Publication Identity

候选身份固定包含 ReleaseSet、Release、Canonical ID、object revision、resource ID、
structural unit、segment 和 resource segment hash。Canonical 变化和资源变化使用同一
候选构造函数，trigger 不进入 identity。稳定 pair identity 与版本化 decision attempt
identity 分离；prompt/input version 或 retry attempt 改变时追加新 decision，并将旧
decision 标记为 `SUPERSEDED`。generator 与 reviewer 分别使用独立 cache key；
资源 hash 改变时只失效相同 resource/structural-unit/segment 的候选。

reviewer 输入由白名单构造，仅包含 Canonical semantic profile、原子 segment、候选角色和
evidence identity/digest，不传递 generator raw prompt、raw response、reasoning 或
confidence。reviewer cache 绑定 reviewer role、candidate digest 与完整白名单输入
digest。provider failure 进入 `REVIEW_RETRYABLE`；FIXTURE accept 不构成 readiness
或人工接受。角色只允许 `EXPLAINS`、`PRACTICES`、`ASSESSES` 和 `REFERENCES`。
高影响 reason 由版本化确定性策略枚举产生，不保存模型自由文本；人工接受保留原 reason。

所有 deterministic、GPT accept 和 human accept 都重新执行 endpoint、revision、role、
Crosswalk、authoritative Evidence alignment 和 uniqueness gate。最高发布状态是
`SHADOW_PUBLISHED`，并绑定已验证 Crosswalk 的 inventory run、atomic resource、
resource/structural-unit/segment/hash、capture revision 和 validation digest。数据库
同时要求 Crosswalk structural-unit version/hash 分别等于 inventory capture revision
和 resource-segment hash。已发布 decision 只有在同事务先持久化同 pair-role replacement
后才能转为 `SUPERSEDED`，replacement 随后成为唯一 CURRENT shadow publication。数据库
约束拒绝缺失 Crosswalk、revision drift、FIXTURE 直发和 `ACTIVE`。

## Persistence and Deployment

Prisma 保存不可变 inventory run/item、Evidence structural-unit Crosswalk、append-only
binding decision、human queue 与 human decision receipt。receipt 绑定 actor、时间、
outcome、rationale、context digest 和 input digest；queue identity/reason 不可修改或
删除，receipt 的 ACCEPT/REJECT 必须分别对应新 decision 的 ACCEPTED/REJECTED review
state。decision 除上述受控 lifecycle supersession 外不可修改或删除。容器在 Release 和
CourseCoverage 导入后生成影子清单；远端
部署验收按当前 `APP_REVISION` 重算清单并核对完整性、计数和 hash，同时拒绝意外
Crosswalk/binding 基线。当前预期结果是清单 complete、
unresolved 大于零、Crosswalk 为零、binding 为零、cutover blocked、authority Legacy。

持久化清单只保存稳定 ID、hash、disposition、reason code 和 observation digest。部署
stdout 只输出捕获身份和计数摘要；两类产物都不包含正文、答案、用户标识、本机绝对路径
或模型原始文本。

## Risks / Trade-offs

- [候选量过大] → 通过索引、缓存身份和变化端触发限制重算。
- [模型审核误判] → 生成与审核隔离，高影响和冲突进入人工裁定。
- [来源证据与教学用途混淆] → 分表、分类型和分权限保存两类关系。

## Migration Plan

先建立 Crosswalk 和绑定实体，再运行当前有效资源的 dry-run 清单；发布确定性绑定，审核语义候选，门禁达到完整覆盖后才允许最终切换。

## Open Questions

无。
