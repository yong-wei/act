建议文件名：`docs/design/20260731-act-1117-latest-stable-aggregate-stage2-recovery-and-teaching-projection-coordination-v2.md`

# ACT #1117 最新稳定 Aggregate 基线迁移与 Teaching Projection 协调实验方案

## 0. 协议标识

```text
protocol:
act-1117-latest-stable-aggregate-stage2-recovery-v2

coordinator:
ACT 主协调会话

worker:
既有 ActKG 协调会话

actkg_session_id:
由用户在执行前提供

base_release_policy:
LATEST_STABLE_AGGREGATE

release_pinning_policy:
RESOLVE_THEN_FREEZE

production_selector_policy:
NO_CHANGE

graph_rag_runtime_policy:
UNCHANGED_BLOCKED
```

本方案是既有 Stage 2 失败实验的派生恢复方案。

既有失败记录：

```text
branch:
cut-over-authoritative-knowledge-and-archive-legacy

commit:
344c579c92693ec3228955d8c9ebae0106cb1490

target_release:
control-theory-engineering-v0.3

result:
BLOCKED
```

必须保持不可变，不覆盖、不改写为通过。

新的执行目标是：

```text
解析 ActKG main 上最新稳定 Aggregate
        ↓
将其导入 ACT 候选发布仓库
        ↓
接受新的 ReleaseSet Delta
        ↓
重建 CURRENT/SHADOW CourseCoverage
        ↓
重新评估并审核九个 KAQ Role → Canonical Mapping
        ↓
闭合 Mapping 持久化与可信重载
        ↓
导出 act-teaching-projection-handoff/1
        ↓
驱动 ActKG 生成 Teaching Projection 增强包
        ↓
ACT shadow 导入并解除 #1117 当前外部阻断
```

---

# 1. 当前预期最新稳定基线

截至本方案制定时，ActKG `main` 已完成 M1I-v1E 最终验证。验证提交为：

```text
034ee80a76a88562ada10d23f4b406f86cc0193a
```

M1I 的发布源提交为：

```text
ef432d0faebb012b19382d71264d9b3e6a83440e
```

包装提交为：

```text
b1287a277735af9809c6c14e6daf881b716015be
```

对应 source tag 与稳定 tag 均已建立，并通过 detached source checkout 重建。

当前预期解析到的最新稳定 Aggregate 为：

```text
release_version:
control-theory-engineering-v0.7

release_id:
ctr:release:control-theory-engineering-v0.7

bundle_id:
ctb:control-theory-engineering-v0.7:r1

release_hash:
e46f854d7a05fd4ec840c5eaff69288e7ce34cb2119da501913cbf457ce91f8e

bundle_digest:
ad33ec039239fc89ff6d74aaa48daedab826344b84742d2a6563f6ae2a9ef1bc

source_dataset_hash:
21e957c750c29efaae3b7ec5d70f8155cc33221dae5faec24f3fda1d59c4f31c

schema_version:
0.2.0

schema_sha256:
3598f0c89f1f32ff1812e823454a17502873ccb5e9577656e6485a7e030233de
```

其公开 Bundle 包含 2990 个知识节点、1356 条正式关系、5724 行 RAG Crosswalk 和七个组件。以上数值只用于当前导入回执核验，不能写成长期固定接口条件。

Graph-RAG runtime intake 仍保持独立阻断。既有报告已证明，Graph-RAG 阻断不否定工程 Aggregate 的发布授权，因此本轮不得修改 Graph-RAG selector，也不得把 Graph-RAG 效用重新纳入 Teaching Projection 门禁。

---

# 2. 全局最新发布包策略

从本方案开始，所有 ACT—ActKG 跨项目协调任务必须使用以下合同。

```text
BASE_RELEASE_SELECTION=LATEST_STABLE_AGGREGATE
SILENT_FALLBACK_TO_OLDER_RELEASE=FORBIDDEN
RESOLVE_AT_RUN_START=REQUIRED
PIN_AFTER_RESOLUTION=REQUIRED
LATEST_RECHECK_BEFORE_HANDOFF=REQUIRED
LATEST_RECHECK_BEFORE_CUTOVER=REQUIRED
```

## 2.1 “最新稳定 Aggregate”的定义

不得只按目录名、GitHub 发布时间或字符串版本号选择。

候选 Bundle 必须同时满足：

```text
bundle_kind=aggregate
release_stage=stable
bundle_contract_version为ACT已支持版本
schema_version为ACT已支持版本
publication.tag存在
source_revision.tag存在
stable tag指向合法包装提交
source tag指向合法源提交
validation-report结果为PASS
SHA256SUMS全部通过
bundle_digest可以重算
component lineage闭合
previous_bundle链闭合
source与packaging提交均可从ActKG main追溯
detached source-tag checkout验证存在且通过
```

在全部合法候选中，以 `previous_bundle` 和 Release 前驱链确定唯一最新端点。

如果出现两个互不继承的稳定 Aggregate 分支：

```text
LATEST_STABLE_AGGREGATE_RESOLUTION_GATE=REJECT
```

不得自行按版本号或发布时间猜测。

## 2.2 动态解析，不在长期代码中写死 v0.7

当前预计结果是 v0.7，但实现必须动态生成：

```text
latest-stable-aggregate-binding.json
```

至少包含：

```json
{
  "resolved_at": "",
  "actkg_main_commit": "",
  "release_id": "",
  "release_version": "",
  "release_hash": "",
  "source_dataset_hash": "",
  "bundle_id": "",
  "bundle_digest": "",
  "manifest_sha256": "",
  "schema_version": "",
  "schema_sha256": "",
  "source_commit": "",
  "source_tag": "",
  "packaging_commit": "",
  "stable_tag": "",
  "validation_report_sha256": "",
  "sha256sums_sha256": "",
  "predecessor_bundle_id": "",
  "resolution_digest": ""
}
```

## 2.3 版本漂移规则

### handoff 冻结前出现新版本

在以下任一时点检测到更高稳定 Aggregate：

```text
Mapping正式审核前
Mapping snapshot冻结前
handoff导出前
```

当前运行停止：

```text
LATEST_RELEASE_DRIFT_GATE=REJECT
```

重新基于新版本执行：

```text
Bundle import
→ Delta
→ CourseCoverage
→ Mapping
```

### handoff 冻结后出现新版本

handoff 一旦导出，不允许静默把其中的 Release 身份替换为新版本。

当前工件可以继续用于：

```text
shadow验证
迁移演练
协议验证
```

但在最终生产 cutover 前必须再次解析最新版本。

如果届时已有新稳定 Aggregate：

```text
LATEST_AT_CUTOVER_GATE=REJECT
PRODUCTION_CUTOVER=BLOCKED_NEW_BASE_REQUIRED
```

必须生成新版本 handoff 和 Teaching Projection 增强包。

---

# 3. 研究问题

## RQ1：旧 Stage 2 的八个 DEFER 是否主要来自发布版本不足

需要比较：

```text
旧基线：
control-theory-engineering-v0.3
744个CourseCoverage Canonical

新基线：
当前最新稳定Aggregate
预计为control-theory-engineering-v0.7
```

逐角色回答：

```text
旧Coverage是否存在合理候选
新Coverage是否存在合理候选
新增候选来自哪个模块
候选身份、类型和证据是否足以支持PRIMARY_IDENTITY
```

## RQ2：最新 Aggregate 是否足以承载九个 KAQ 宏观知识角色

目标角色：

```text
反馈与闭环控制
传递函数模型
时域响应与性能指标
根轨迹分析
频域响应判读
稳定裕度
控制器与校正
仿真验证与跨模型比较
现代控制与船海迁移
```

本轮不允许因为名称近似而强制完成 Mapping。

每个角色必须形成：

```text
唯一PRIMARY_IDENTITY
或
明确的BLOCKED_NO_CANONICAL_CANDIDATE
```

任何路径相关角色仍为 `DEFER` 时，不得导出正式 handoff。

## RQ3：两个 P1 信任缺口能否被真正关闭

需要验证：

1. 外部调用者不能再通过 raw DB row 直接 mint capability；
2. Third 裁决能够形成 Binding 的最终 `ACCEPTED/REJECTED` 状态。

## RQ4：Mapping 是否能够成为可持久化、可重载、可导出的权威治理资产

目标链路：

```text
数据库Binding事实
→ 追加式审核记录
→ Mapping snapshot
→ DB重新加载
→ 内部capability mint
→ handoff导出
```

## RQ5：Teaching Projection 增强包能否绑定最新 Aggregate

要求：

```text
Teaching Projection
Relation Set Digest
Attestation
CourseCoverage
Mapping Digest
```

全部绑定本轮解析的最新稳定 Aggregate，不得继续绑定 v0.3。

---

# 4. 新运行与分支

建议 ACT 分支：

```text
codex/1117-latest-aggregate-stage2-recovery
```

建议协议运行 ID：

```text
act-1117-stage2r-<latest-resolution-digest-prefix>
```

建议 ActKG 派生协议：

```text
ctkg-m1j-v2t-latest-aggregate-teaching-projection-v1
```

建议交接文档：

```text
ACT:
docs/coordination/1117/
stage-2r-act-latest-handoff-ready.md

ActKG:
docs/coordination/m1j/
stage-3r-actkg-latest-bundle-ready.md

ACT:
docs/coordination/1117/
stage-4r-act-latest-validation-final.md
```

既有：

```text
stage-2-act-handoff-ready.md
```

继续保持 `BLOCKED`，不覆盖。

---

# 5. 最多五轮不可变迭代

| 轮次          | 主要目标                         | 成功产物                               |
| ----------- | ---------------------------- | ---------------------------------- |
| Iteration 1 | 解析并导入最新 Aggregate            | Latest binding、Bundle Receipt      |
| Iteration 2 | 接受 Delta、重建 Coverage、角色可行性诊断 | 新 Delta、Coverage、九角色候选报告           |
| Iteration 3 | 修复两个 P1、应用迁移、完成 Mapping 审核   | 持久化 Binding、Reviewed Mapping       |
| Iteration 4 | 导出 handoff，驱动 ActKG 发布增强包    | handoff、Teaching Projection Bundle |
| Iteration 5 | ACT shadow 导入和 #1117 验证      | Proof、路径等价、blocker 解除报告            |

每轮必须使用新的不可变 attempt 目录。

每轮允许：

```text
一次初始执行
一次针对明确阻断的定向修复
```

定向修复后仍失败，则停止，不继续放宽门槛。

---

# 6. Iteration 1：解析并导入最新稳定 Aggregate

## 6.1 同步代码基线

ACT：

```text
git fetch origin
基于最新origin/integration创建新分支
```

ActKG：

```text
git fetch origin
解析最新origin/main及稳定tag
```

旧 Stage 2 代码可定向迁移，但不得直接以落后分支继续运行。

应从提交：

```text
344c579c92693ec3228955d8c9ebae0106cb1490
```

提取已经验证有效的：

```text
Binding persistence实现
handoff实现
Mapping digest实现
测试
```

并移植到最新 `origin/integration` 基线。

## 6.2 最新版本解析

建议新增或复用：

```text
scripts/knowledge-cutover/resolve-latest-actkg-aggregate.ts
```

输入：

```text
ActKG main
ActKG stable tags
ActKG releases目录
ACT支持的Bundle Contract
ACT支持的Schema版本
```

输出：

```text
latest-stable-aggregate-binding.json
```

## 6.3 Bundle 完整验证

验证：

```text
bundle-manifest
SHA256SUMS
validation-report
Release raw bytes
runtime/domain/review Projection
Projection Link Metadata
RAG Crosswalk
component-releases
previous_bundle
source tag
stable tag
```

当前预计：

```text
LATEST_STABLE_AGGREGATE=control-theory-engineering-v0.7
```

但最终报告必须采用解析结果，而不是方案中的预计值。

## 6.4 导入 ACT 候选仓库

不得覆盖现有：

```text
actkg-authoritative-candidate-v3-r2
```

应创建新的不可变 ReleaseSet，例如：

```text
actkg-authoritative-candidate-v7-r1
```

实际 ID 由导入器确定，不硬编码。

导入后必须产生：

```text
ActkgReleaseSet.state=CANDIDATE
ActkgBundleReceipt.state=ACCEPTED_CANDIDATE
```

如果完全相同 Bundle 已存在：

```text
复用既有Receipt
验证幂等性
不得重复创建ReleaseSet
```

## 6.5 导入核验

```text
Release ID一致
Release Hash一致
sourceDatasetHash一致
Bundle Digest一致
Schema一致
组件数一致
节点数一致
关系数一致
Crosswalk行数一致
Projection Link Metadata关系集一致
```

这些计数来自当前 Manifest，只是导入回执，不是长期协议常量。

## 6.6 Iteration 1 门禁

```text
LATEST_STABLE_AGGREGATE_RESOLUTION_GATE=PASS
LATEST_BUNDLE_INTEGRITY_GATE=PASS
LATEST_BUNDLE_COMPATIBILITY_GATE=PASS
LATEST_CANDIDATE_IMPORT_GATE=PASS
LATEST_BUNDLE_RECEIPT_GATE=PASS
OLD_CANDIDATE_IMMUTABILITY_GATE=PASS
PRODUCTION_SELECTOR_CHANGE=0
```

---

# 7. Iteration 2：Delta、CourseCoverage 与角色可行性

## 7.1 生成最新 ReleaseSet Delta

Delta 必须比较：

```text
当前ACT已治理候选基线
→
最新稳定Aggregate候选ReleaseSet
```

至少报告：

```text
新增Canonical
删除Canonical
身份变化
类型变化
新增关系
删除关系
关系谓词变化
Crosswalk变化
组件变化
```

不得把 v0.3 到 v0.7 的所有新增内容直接自动授权。

## 7.2 Delta 审核与接受

必须产生：

```text
ActkgReleaseSetDeltaReceipt.authorizationState=ACCEPTED
```

且绑定：

```text
最新ReleaseSet ID
最新Release ID
最新Release Hash
最新sourceDatasetHash
最新Bundle Receipt
```

## 7.3 重建 CourseCoverage

创建新的 Coverage 版本，不修改旧：

```text
automatic-control-aggregate-coverage-v2@1
```

实际版本号由系统确定。

状态：

```text
lifecycleState=CURRENT
authorityState=SHADOW
productionAuthoritative=false
```

绑定：

```text
最新ReleaseSet
最新Release
最新Accepted Delta
最新sourceDatasetHash
```

## 7.4 CourseCoverage 重建规则

CourseCoverage 可以使用既有课程范围规则，但必须在新 Aggregate 上重新计算。

不能：

```text
把旧744个Canonical ID直接复制
按名称把旧节点替换到新节点
默认所有2990个节点都属于课程
```

必须逐项验证：

```text
Canonical存在
Canonical处于当前Release
对象类型受课程支持
对象生命周期可用
课程范围规则成立
```

## 7.5 九角色候选生成

对每个角色生成稳定候选包。

候选信号可包括：

```text
中文和英文正式标签
别名
语义说明
Canonical类型
所属模块
来源教材
Evidence摘要
邻域关系
现有资源覆盖
旧KAQ knowledgeRefs
```

这些信号只用于召回和排序。

不得仅凭：

```text
同名
Legacy ID
字符串相似度
章节顺序
旧测试fixture
```

生成正式 Binding。

## 7.6 旧版—最新版可行性差异

每个角色必须报告：

| 角色         | v0.3候选 | 最新版候选 | 新增候选来源模块 | 当前可行性 |
| ---------- | -----: | ----: | -------- | ----- |
| 反馈与闭环控制    |        |       |          |       |
| 传递函数模型     |        |       |          |       |
| 时域响应与性能指标  |        |       |          |       |
| 根轨迹分析      |        |       |          |       |
| 频域响应判读     |        |       |          |       |
| 稳定裕度       |        |       |          |       |
| 控制器与校正     |        |       |          |       |
| 仿真验证与跨模型比较 |        |       |          |       |
| 现代控制与船海迁移  |        |       |          |       |

可行性状态：

```text
VIABLE_PRIMARY_CANDIDATE
VIABLE_COMPOSITE_CANDIDATE
AMBIGUOUS_MULTIPLE_PRIMARY
NO_SEMANTIC_CANDIDATE
OUTSIDE_CURRENT_GRAPH_SCOPE
```

## 7.7 `KAQ_ROLE_COVERAGE_FEASIBILITY_GATE`

门禁要求：

```text
九个角色全部有最终可行性诊断
全部候选属于最新CourseCoverage
全部候选具有可审核语义证据
路径相关角色NO_SEMANTIC_CANDIDATE=0
路径相关角色AMBIGUOUS_MULTIPLE_PRIMARY=0
依靠名称自动接受数=0
依靠Legacy ID自动接受数=0
```

本轮继续沿用九角色正式 Mapping 合同。

如果某个角色被证明本质上不是 Canonical 知识对象，而是活动、评价或迁移场景：

```text
本轮停止
生成KAQ角色类型合同修订建议
不得在执行中临时豁免该角色
```

这样避免为了通过门禁，把活动或教学场景强行绑定到近似知识节点。

## 7.8 Iteration 2 门禁

```text
LATEST_DELTA_BUILD_GATE=PASS
LATEST_DELTA_ACCEPTANCE_GATE=PASS
LATEST_COURSE_COVERAGE_GATE=PASS
COURSE_COVERAGE_RELEASE_ALIGNMENT_GATE=PASS
KAQ_ROLE_COVERAGE_FEASIBILITY_GATE=PASS
OLD_TO_LATEST_ROLE_FEASIBILITY_DIFF=COMPLETE
PRODUCTION_SELECTOR_CHANGE=0
```

只有此轮通过，才继续修复持久化与审核链。

---

# 8. Iteration 3：关闭 P1、应用迁移并完成正式 Mapping

## 8.1 P1-1：关闭 raw-row capability mint

当前问题：

```text
restoreReviewedKaqCanonicalBindingFromDb()
```

可以被深路径导入并接受调用者提供的 raw row，从而绕过真实数据库加载边界。

### 修复要求

1. 删除公开 raw-row 恢复入口；
2. 不从 barrel export 导出；
3. 将底层行转换器放入 `server-only` 内部模块；
4. 只有 Repository 内部数据库查询结果可以进入转换器；
5. 数据库查询必须在事务内读取：

   * Binding；
   * 审核记录；
   * ReleaseSet；
   * Delta；
   * CourseCoverage；
   * Canonical payload；
6. 重新计算：

   * `objectRevision`；
   * `evidenceDigest`；
   * `bindingDigest`；
   * `pinnedContextDigest`；
7. 全部通过后，才由内部 authority module mint capability。

### 禁止

```text
外部代码传入任意plain object
JSON反序列化后直接mint
测试fixture进入生产loader
深路径导入内部restore函数
```

### 测试

```text
公开导出面不存在raw restore
深路径导入受lint/边界测试阻断
伪造row不能mint
数据库外Canonical不能mint
错误objectRevision不能mint
错误Coverage不能mint
错误Delta不能mint
真实DB reload可以mint
```

## 8.2 P1-2：Third 裁决写入 Binding 终态

正式状态机：

```text
Primary与Challenger一致ACCEPT
→ ACCEPTED

Primary与Challenger一致REJECT
→ REJECTED

Primary与Challenger分歧
→ THIRD_REQUIRED

Third=ACCEPT
→ ACCEPTED

Third=REJECT
→ REJECTED

Third=DEFER
→ DEFERRED
```

Third 结果必须原子写入：

```text
BindingReview
Binding.reviewState
Binding.lifecycleState
Mapping snapshot candidate
```

要求：

```text
追加式审核记录
旧Primary/Challenger不可覆盖
Third输入绑定双方决定Digest
重复执行幂等
并发裁决只有一个终态
```

## 8.3 Prisma migration

先在测试或 shadow 数据库运行：

```text
prisma migrate deploy
prisma generate
prisma validate
```

迁移前生成：

```text
数据库schema snapshot
目标表行数
约束清单
触发器清单
```

迁移后验证：

```text
Binding表存在
Review表存在
MappingVersion表存在
唯一约束有效
外键有效
objectRevision漂移检查有效
CURRENT Mapping唯一性有效
```

不得在 migration 未应用的情况下继续用进程内对象生成正式 handoff。

## 8.4 正式 Binding 审核

每个角色执行：

```text
Primary
+
独立Challenger
+
必要Third
```

审核者只读取：

```text
角色定义
候选Canonical
Canonical来源和证据摘要
CourseCoverage身份
绑定合同
```

不读取：

```text
通过门槛
其他审核者结论
最终需要多少ACCEPT
```

正式动作：

```text
ACCEPT_PRIMARY_IDENTITY
ACCEPT_COMPOSITION_PART
ACCEPT_SUPPORTING_OBJECT
REJECT
DEFER
```

每个路径相关角色必须具有：

```text
恰好一个ACCEPTED/CURRENT PRIMARY_IDENTITY
```

允许：

```text
多个COMPOSITION_PART
多个SUPPORTING_OBJECT
```

但它们不能替代 PRIMARY_IDENTITY。

## 8.5 Mapping snapshot

生成：

```text
ActkgKaqReviewedMappingVersion
```

至少绑定：

```text
最新ReleaseSet
最新Release
最新ReleaseHash
最新sourceDatasetHash
最新DeltaReceipt
最新CourseCoverage
pinnedContextDigest
九个角色
全部Binding ID
全部审核记录Digest
mappingDigest
captureRevision
```

## 8.6 可信重载

执行：

```text
数据库连接关闭
进程重启
从DB重新加载
重新校验全部身份
重新mint ReviewedKaqRoleCanonicalMapping
重新计算 mappingDigest
```

要求：

```text
重载前后mappingDigest完全相同
重载后capability有效
普通JSON副本无效
删除任一审核记录后重载失败
篡改任一Canonical revision后重载失败
```

## 8.7 Iteration 3 门禁

```text
RAW_ROW_MINT_BOUNDARY_GATE=PASS
THIRD_TERMINAL_TRANSITION_GATE=PASS
PRISMA_MIGRATION_GATE=PASS
KAQ_BINDING_PERSISTENCE_GATE=PASS
KAQ_BINDING_REVIEW_GATE=PASS
KAQ_MAPPING_SNAPSHOT_GATE=PASS
KAQ_TRUSTED_RELOAD_GATE=PASS

ROLE_DISPOSITION_COUNT=9/9
PRIMARY_IDENTITY_COVERAGE=9/9
MULTIPLE_PRIMARY_IDENTITY_COUNT=0
DEFER_ROLE_COUNT=0
COURSE_COVERAGE_OUTSIDE_BINDING_COUNT=0
```

---

# 9. Iteration 4A：ACT 导出最新版本 handoff

## 9.1 导出前最新版本复核

重新执行最新 Aggregate 解析。

要求：

```text
当前解析到的最新Release
=
Mapping snapshot绑定的Release
```

否则：

```text
LATEST_RELEASE_STILL_CURRENT_GATE=REJECT
HANDOFF_EXPORT_GATE=BLOCKED
```

## 9.2 handoff 输出

输出：

```text
data/private/cross-repo/teaching-projection/
act-teaching-projection-handoff-v1.json
```

必须绑定：

```text
最新ReleaseSet
最新Release
最新Release Hash
最新sourceDatasetHash
最新Bundle Receipt
最新Accepted Delta
最新CourseCoverage
最新Reviewed Mapping
九个角色Mapping
当前KAQ K2K Inventory
宏观路径场景
```

## 9.3 K2K Inventory

保留原始 KAQ 谓词，不在 ACT 侧预先转换：

```text
supports
depends-on
applies
constrains
assesses
transfers-to
```

每条边包含：

```text
edgeId
sourceRoleId
targetRoleId
sourceCanonicalId
targetCanonicalId
originalPredicate
strength
rationaleDigest
mappingDigest
pinnedContextDigest
```

ACT 不得提前将其转换为：

```text
contains
prerequisite
association
```

## 9.4 交叉验证

使用 ActKG 当前冻结 validator：

```text
validate_teaching_projection_handoff.py
```

验证正式文件，而不是 `/tmp` 临时文件。

要求：

```text
Schema PASS
handoff_digest PASS
Release身份 PASS
Mapping Digest PASS
CourseCoverage Digest PASS
K2K Inventory Digest PASS
```

## 9.5 Stage 2R 交接文档

ACT 写：

```text
docs/coordination/1117/
stage-2r-act-latest-handoff-ready.md
```

至少包含：

```text
ACT分支
ACT提交
最新Release解析证据
ReleaseSet
Release
Release Hash
Bundle ID/Digest
Delta Receipt
CourseCoverage
九角色Mapping表
Mapping Digest
handoff绝对路径
handoff SHA-256
handoff_digest
全部门禁
```

状态必须为：

```text
PASS
```

---

# 10. Iteration 4B：驱动 ActKG 生成增强包

ACT 主协调会话恢复既有 ActKG 会话，并发送：

```text
请重新读取：

<ACT_ROOT>/docs/coordination/1117/
stage-2r-act-latest-handoff-ready.md

不要继续使用旧v0.3输入，也不要依赖此前会话记忆。

请验证：
1. handoff绝对路径；
2. handoff SHA-256；
3. handoff_digest；
4. ReleaseSet、Release、Release Hash；
5. sourceDatasetHash；
6. Bundle Digest；
7. CourseCoverage；
8. Mapping Digest；
9. 当前ActKG main上的最新稳定Aggregate仍与handoff一致。

若任一不一致，fail-closed。

验证通过后，执行M1J-v2T：
- 全量审核K2K候选；
- 生成非空Teaching Projection；
- 生成Relation Set Digest；
- 生成Attestation；
- 生成actkg-teaching-projection-bundle/1增强包；
- 不修改基础工程Release、Bundle或CTKG Schema；
- 完成后写stage-3r-actkg-latest-bundle-ready.md。
```

## 10.1 ActKG 输入门禁

```text
HANDOFF_IMPORT_GATE=PASS
LATEST_RELEASE_MATCH_GATE=PASS
COURSE_CONTEXT_BINDING_GATE=PASS
ROLE_MAPPING_GATE=PASS
K2K_INVENTORY_GATE=PASS
```

## 10.2 关系策展

九条或相应 K2K 候选全部执行：

```text
Primary 100%
Challenger 100%
Third处理全部实质分歧
```

允许终局：

```text
prerequisite
contains
association
duplicate
reject
defer
```

要求：

```text
路径相关defer=0
关系集非空
prerequisite环=0
contains环=0
重复三元组=0
```

## 10.3 增强包身份

建议保持：

```text
automatic-control-teaching-projection-v0.1
```

其基础版本必须明确是当前解析的最新 Aggregate。

如果之前没有正式发布 v0.1，可以继续使用该版本号；既有失败实验不构成已发布版本。

## 10.4 Stage 3R 交接文档

ActKG 写：

```text
docs/coordination/m1j/
stage-3r-actkg-latest-bundle-ready.md
```

包含：

```text
基础Aggregate身份
Projection ID
Projection Digest
Relation Set Digest
Attestation Digest
增强包路径
Bundle Digest
Manifest SHA-256
Validation Report SHA-256
SHA256SUMS SHA-256
source commit/tag
packaging commit/tag
九条K2K输入逐项处置
全部门禁
```

---

# 11. Iteration 5：ACT shadow 导入和最终验证

## 11.1 导入方式

Teaching Projection 增强包作为：

```text
当前最新CANDIDATE Aggregate ReleaseSet
的版本绑定增强层
```

导入。

不得：

```text
创建第二个Aggregate ReleaseSet
替换工程Projection
覆盖runtime/domain/review Projection
修改Graph-RAG selector
```

## 11.2 正式 Proof mint

ACT 验证：

```text
Bundle Receipt
Accepted Delta
CourseCoverage
Reviewed Mapping
Teaching Projection
Relation Set Digest
Attestation
```

通过后内部 mint：

```text
FormalTeachingProjectionProof
```

外部 JSON 不能直接作为 capability。

## 11.3 Availability

必须：

```text
resolveTeachingProjectionAvailability().available=true
```

负例必须返回 false：

```text
Release Hash漂移
sourceDatasetHash漂移
Mapping Digest漂移
CourseCoverage漂移
Projection Digest漂移
Relation Set Digest漂移
缺失Attestation
```

## 11.4 冲突迁移

比较：

```text
现有KAQ K2K边
×
正式ActKG Teaching关系
```

状态：

```text
ACCEPTED_ACTKG
RETIRED_KAQ
RETAIN_KAQ
UNRESOLVED
```

成功要求：

```text
路径相关UNRESOLVED=0
同一知识关系并行激活=0
应迁移的KAQ边有明确crosswalk
能力/素养/目标关系不受影响
```

## 11.5 宏观路径等价

至少验证：

```text
反馈结构 → 传递函数模型
传递函数模型 → 时域分析
时域分析 → 根轨迹
根轨迹 → 控制器校正
频域分析 → 稳定裕度
稳定裕度 → 控制器校正
控制器校正 → 仿真验证
仿真验证 → 现代控制与船海迁移
```

要求：

```text
切换前角色路径可达
切换后Canonical路径可达
必需角色丢失=0
新增环=0
空Teaching关系集=false
```

## 11.6 Selector 不变性

本轮仅授权：

```text
shadow import
proof mint
冲突预览
路径预演
cutover rehearsal
```

必须保持：

```text
生产知识selector不变
生产诊断selector不变
生产推荐selector不变
生产路径selector不变
Graph-RAG selector不变
历史LearningFact不变
```

## 11.7 #1117 状态

全部通过后：

```text
ACT_1117_EXTERNAL_BLOCKER=
RESOLVED_FOR_CUTOVER_REHEARSAL
```

仍然：

```text
PRODUCTION_CUTOVER=NOT_RUN
```

---

# 12. 增量与漂移验证

## 12.1 Latest Release 漂移

修改测试夹具中的最新 Release Hash：

```text
旧Mapping snapshot必须STALE
旧handoff必须STALE
旧Teaching Projection Attestation必须失效
ACT不得mint正式Proof
```

## 12.2 CourseCoverage 扣留

移除一个路径关键 Canonical：

```text
相关Mapping失效
Mapping Digest变化
handoff无法重放
Teaching关系端点验证失败
```

## 12.3 Binding 扣留

移除一个 PRIMARY_IDENTITY：

```text
Mapping snapshot失效
宏观路径门禁失败
不得自动选择SUPPORTING_OBJECT代替
```

## 12.4 Third 决策重放

构造一个 Primary/Challenger 分歧：

```text
Third=ACCEPT
→ Binding ACCEPTED

Third=REJECT
→ Binding REJECTED
```

重放后状态、审核记录和 Digest 必须确定性一致。

## 12.5 Bundle 扣留

移除一条正式 Teaching 关系：

```text
Relation Set Digest变化
Attestation失效
Formal Proof不可mint
```

恢复后全部摘要精确恢复。

---

# 13. 私有与公开边界

## 13.1 私有

```text
ACT数据库Binding记录
完整审核理由
审核者身份
角色候选排名
CourseCoverage内部规则
handoff完整JSON
模型Prompt与原始响应
路径实例
LearningFact
学生数据
教材正文
exact_quote
本机绝对路径
API密钥
```

## 13.2 可提交或公开

```text
最新Release身份与哈希
Mapping数量统计
角色最终处置摘要
Mapping Digest
handoff SHA-256
Teaching Projection
正式教学关系
Relation Set Digest
Attestation
Validation Report
Bundle Manifest
Release Notes
SHA256SUMS
```

公开增强包不得包含：

```text
完整KAQ审核理由
数据库主键之外的内部用户身份
教材正文
学生或教师个人数据
```

---

# 14. 停止条件

出现以下任一项立即停止。

## 最新发布基线

```text
无法唯一解析最新稳定Aggregate
最新Bundle验证失败
ACT不支持最新Bundle Contract
ACT不支持最新Schema
尝试静默退回旧版本
```

## Delta 与 Coverage

```text
最新Bundle不能导入
最新Delta不能接受
CourseCoverage不能重建
Coverage仍绑定旧Release
```

## 九角色可行性

```text
路径相关角色没有语义候选
角色只依赖同名或Legacy ID
多个PRIMARY候选无法消歧
任何路径相关角色仍为DEFER
```

## 信任边界

```text
raw-row restore仍可外部调用
普通JSON仍可mint capability
Third不能形成终态
迁移未应用
可信重载Digest不一致
```

## handoff

```text
最新版本复核失败
handoff validator失败
Mapping Digest不一致
CourseCoverage Digest不一致
```

## ActKG 发布

```text
正式Teaching关系集为空
路径相关关系未决
关系形成环路
增强包修改了基础工程Release
增强包不可复现
```

## ACT 验证

```text
Proof不能mint
Availability=false
存在未解决冲突
宏观路径丢失
selector被提前移动
历史LearningFact变化
```

---

# 15. 实验报告要求

最终报告至少包括以下章节。

## 15.1 最新版本解析

```text
ActKG main提交
候选稳定Aggregate列表
唯一最新版本判定依据
Release和Bundle身份
source/stable tag
detached rebuild证据
```

## 15.2 v0.3 → 最新版差异

```text
新增模块
新增Canonical
新增关系
新增Crosswalk
组件变化
Schema变化
Bundle Contract变化
```

## 15.3 九角色可行性对照

| 角色 | v0.3结果 | 最新版候选 | 最终PRIMARY_IDENTITY | 证据 | 审核结果 |
| -- | ------ | ----- | ------------------ | -- | ---- |

必须解释旧版八个 DEFER 的根因：

```text
版本缺失
候选召回缺失
语义歧义
角色本体边界问题
审核实现问题
```

不能统一归因为“模型未通过”。

## 15.4 两个 P1 修复

报告：

```text
raw-row公开边界如何关闭
公开export变化
负向测试
Third状态转换
并发与幂等测试
```

## 15.5 持久化与可信重载

```text
Migration身份
Binding数量
Review数量
Mapping snapshot
Mapping Digest
进程重启重载结果
普通JSON负例
```

## 15.6 handoff

```text
handoff contract version
绝对路径
raw SHA-256
handoff_digest
Release身份
Coverage身份
Mapping Digest
K2K inventory digest
ActKG validator结果
```

## 15.7 Teaching Projection

```text
Projection ID
Projection Digest
Relation Set Digest
正式关系清单
九条KAQ边逐项处置
Attestation Digest
Bundle Digest
```

## 15.8 ACT shadow 验证

```text
导入Receipt
Proof mint
Availability
冲突迁移
路径等价
selector不变
LearningFact不变
```

## 15.9 Latest drift

报告三个时间点：

```text
运行开始
handoff导出前
最终cutover rehearsal前
```

是否仍为最新版本。

---

# 16. 最终机器裁决

```text
LATEST_STABLE_AGGREGATE_RESOLUTION_GATE=PASS|REJECT
LATEST_BUNDLE_INTEGRITY_GATE=PASS|REJECT
LATEST_BUNDLE_COMPATIBILITY_GATE=PASS|REJECT
LATEST_CANDIDATE_IMPORT_GATE=PASS|REJECT
LATEST_BUNDLE_RECEIPT_GATE=PASS|REJECT

LATEST_DELTA_BUILD_GATE=PASS|REJECT
LATEST_DELTA_ACCEPTANCE_GATE=PASS|REJECT
LATEST_COURSE_COVERAGE_GATE=PASS|REJECT
KAQ_ROLE_COVERAGE_FEASIBILITY_GATE=PASS|REJECT

RAW_ROW_MINT_BOUNDARY_GATE=PASS|REJECT
THIRD_TERMINAL_TRANSITION_GATE=PASS|REJECT
PRISMA_MIGRATION_GATE=PASS|REJECT
KAQ_BINDING_PERSISTENCE_GATE=PASS|REJECT
KAQ_BINDING_REVIEW_GATE=PASS|REJECT
KAQ_MAPPING_SNAPSHOT_GATE=PASS|REJECT
KAQ_TRUSTED_RELOAD_GATE=PASS|REJECT

LATEST_RELEASE_STILL_CURRENT_GATE=PASS|REJECT
HANDOFF_EXPORT_GATE=PASS|REJECT
ACTKG_HANDOFF_IMPORT_GATE=PASS|REJECT

TEACHING_RELATION_ADJUDICATION_GATE=PASS|REJECT
TEACHING_PROJECTION_GATE=PASS|REJECT
RELATION_SET_DIGEST_GATE=PASS|REJECT
FORMAL_ATTESTATION_GATE=PASS|REJECT
TEACHING_ENHANCEMENT_BUNDLE_GATE=PASS|REJECT

ACT_ENHANCEMENT_IMPORT_GATE=PASS|REJECT
ACT_FORMAL_PROOF_MINT_GATE=PASS|REJECT
TEACHING_PROJECTION_AVAILABILITY_GATE=PASS|REJECT
CONFLICT_MIGRATION_GATE=PASS|REJECT
MACRO_PATH_PARITY_GATE=PASS|REJECT
SELECTOR_INVARIANCE_GATE=PASS|REJECT
HISTORICAL_LEARNING_FACT_GATE=PASS|REJECT

LATEST_RELEASE_POLICY_COMPLIANCE=PASS|REJECT
LATEST_AT_CUTOVER_GATE=PASS|REJECT|NOT_RUN

ACT_1117_EXTERNAL_BLOCKER=
RESOLVED_FOR_CUTOVER_REHEARSAL
| BLOCKED

PRODUCTION_CUTOVER=NOT_RUN
FULL_TEACHING_SEMANTICS_STATUS=DEFERRED
GRAPH_RAG_RUNTIME_INTAKE=UNCHANGED_BLOCKED
```

---

# 17. 授权逻辑

## Stage 2R handoff 授权

必须全部通过：

```text
最新Aggregate合法导入
最新Delta为ACCEPTED
最新Coverage为CURRENT/SHADOW
九角色可行性闭合
九角色Mapping终态闭合
两个P1关闭
Migration已应用
可信重载通过
handoff validator通过
```

## Teaching Projection 增强包授权

还需：

```text
handoff身份闭合
关系集非空
全部候选终局裁决
路径相关未决为0
无环路
Projection与Attestation闭合
基础工程Release零变化
Bundle可复现
```

## #1117 外部阻断解除

还需：

```text
ACT shadow导入成功
Formal Proof可mint
Availability=true
冲突迁移无未决
宏观路径等价
selector保持不变
```

## 生产切换

本方案不授权生产切换。

生产切换前必须再次执行：

```text
LATEST_STABLE_AGGREGATE_RESOLUTION
```

并确认：

```text
当前Teaching Projection基础Release
=
届时最新稳定Aggregate
```

否则必须重新生成增量 Mapping、handoff 和增强包。

---

# 18. 后续协调任务的固定条款

今后所有 ACT—ActKG 协调方案必须自然包含：

```text
1. 从ActKG main动态解析最新稳定Aggregate；
2. 禁止写死旧Release版本；
3. 禁止静默降级到旧Bundle；
4. 解析后冻结确切Release、Bundle和Dataset身份；
5. handoff导出前重新检查最新状态；
6. production cutover前再次检查最新状态；
7. 新版本出现后，旧增强包自动变为STALE；
8. 任何CourseCoverage、Mapping、Teaching Projection和Proof
   必须绑定同一个最新Release上下文。
```

本轮真正要验证的是：

[
\boxed{
\text{八个 DEFER 是否源于旧 v0.3 的语义覆盖不足，
以及最新 Aggregate 能否形成完整、可信、可交接的九角色 Mapping。}
]

在这一问题闭合前，不应继续围绕旧 v0.3 修补审核结果；在 Mapping、handoff 和 Teaching Projection 闭合后，也不得绕过最新版本检查直接进入生产 cutover。
