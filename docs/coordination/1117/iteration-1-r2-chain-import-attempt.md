# Issue #1117 Iteration 1：r2 修订链导入尝试

记录日期：2026-07-31

## 捕获身份

- ACT 分支：`codex/1117-latest-aggregate-stage2-recovery`
- ACT capture revision：`c24bda463b196cfed6ba13e9b19bb92e9c5c7aad`
- ActKG 协调分支：`codex/1117-release-diff-revisions-r2`
- ActKG 协调 HEAD：`cef6661dbd9131234b07949e73f3897e3c18473a`
- ActKG packaging commit：`683014a8f8970b41c73a6c9137b8a57edbca0ffd`
- latest resolution digest：`e9c4f94b5bf43012ac44cb42a56cb3732b5a3715723c39013d927ddbb296d8d8`
- 解析端点：`ctb:control-theory-engineering-v0.8:r2`
- 历史根闭合摘要：`41745f666ae98bc7944bb9d5c5fd0045e3b06043df7e87b61d198bc4cb540138`

ACT 解析出的活动链为：

```text
ctb:control-theory-engineering-v0.3:r2
→ ctb:control-theory-engineering-v0.4:r2
→ ctb:control-theory-engineering-v0.5:r2
→ ctb:control-theory-engineering-v0.6:r2
→ ctb:control-theory-engineering-v0.7:r2
→ ctb:control-theory-engineering-v0.8:r2
```

五个候选包、组件、Lock、冻结解析与历史根闭合工件共同记录在：

```text
course-content/authoring/knowledge/issue-1117-v08-r2-chain/
```

## 兼容性修复与验证

本轮补充了以下严格兼容项：

- M1H：`m1h-v1f-release-tier-preserving`；
- M1K：`m1k-v1d-release-tier-preserving`；
- M1K Graph-RAG disposition：`UNCHANGED_BLOCKED` 与旧值 `BLOCKED` 均表示禁止 runtime intake；其他值继续拒绝；
- `release_version` 只能是单一路径段，不允许绝对路径、`..`、斜杠、反斜杠或 NUL。

提交后在干净 HEAD 对五个 Lock 逐一运行正式 `loadAndValidatePublicBundleV1`，全部通过，且 capture revision 均为 `c24bda463b196cfed6ba13e9b19bb92e9c5c7aad`。

## 隔离数据库

默认 schema 已保留上一轮无效 v0.7 Bundle receipt 与拒绝 Delta；继续使用会让 v0.4 错选 v0.7 作为时间序前驱。因此本轮创建独立 PostgreSQL schema：

```text
issue1117_v08r2_c24bda4
```

87 个 Prisma migration 全部成功应用。由于现有 trigger function 使用未限定表名，单独设置 Prisma `schema` 不足；导入进程还必须设置会话级：

```text
search_path=issue1117_v08r2_c24bda4,public
```

该设置只改变隔离实验连接的对象解析，不修改 migration、默认 schema 或生产配置。

## 基线导入

v0.2 exact 基线导入成功：

```text
releaseId=control-theory-engineering-v0.2
candidateState=CANDIDATE
repositoryStatus=available
```

v0.3-r2 标准 Bundle 导入成功：

```text
releaseId=ctr:release:control-theory-engineering-v0.3
bundleId=ctb:control-theory-engineering-v0.3:r2
bundleDigest=ab6c33fb06d4beefda1c23f8329619caf4e572e252ddd69ba443d2a48364acb9
candidateState=ACCEPTED_CANDIDATE
deltaReceipt=delta-receipt:9a3f3f88c4ada2e78e7d7735f717df3d7974ed4f50a2450375c356c4a37ef9d9
deltaAuthorization=ACCEPTED
upstreamCrosscheckStatus=NOT_REQUIRED
selectorsUnchanged=true
```

## v0.4-r2 停止证据

v0.4-r2 Bundle 与语义内容导入成功，但 Delta 严格拒绝：

```text
releaseId=ctr:release:control-theory-engineering-v0.4
bundleId=ctb:control-theory-engineering-v0.4:r2
bundleDigest=34d80745794b4c4a6ab90dcc4c04bf2f71c6b618954e53b3213f7e6daaa8759b
candidateState=ACCEPTED_CANDIDATE
deltaReceipt=delta-receipt:c6c6030646e2948b743f0254e30fae8e9e77dba4359249b4dd8bda3d7e15a0fe
deltaAuthorization=REJECTED_UPSTREAM
upstreamCrosscheckStatus=DISAGREED
selectorsUnchanged=true
```

Crosswalk 与关系差异已经一致；剩余分歧为：

- ACT `objects.added=540`，上游 `objects.added=565`；
- 上游额外计入 15 个 `ctkg:v3e-relation-evidence-*` 与 10 个 `ctr:m1f-v3e-review-*`，这些对象不属于 ACT 标准 Bundle 的 Release authoritative semantic snapshot；
- ACT `components.removed=[ctr:release:control-theory-integration-v0.1]`，上游 `components.removed=[]`。

因此上游 r2 Diff 仍未与 ACT 消费合同闭合。按照停止条件，未尝试 v0.5-r2、v0.6-r2、v0.7-r2 或 v0.8-r2，也未进入 CourseCoverage 或 Stage 2。

## 当前门禁

```text
LATEST_STABLE_AGGREGATE_RESOLUTION_GATE=PASS
LATEST_BUNDLE_INTEGRITY_GATE=PASS
LATEST_CHAIN_LOCK_GATE=PASS
LATEST_CHAIN_CLEAN_CAPTURE_GATE=PASS
V0_3_BASELINE_DELTA_GATE=PASS
V0_4_DELTA_GATE=REJECTED_UPSTREAM
V0_5_TO_V0_8_DELTA_GATE=NOT_RUN
LATEST_COURSE_COVERAGE_ALIGNMENT_GATE=NOT_RUN
STAGE_2_GATE=NOT_RUN
PRODUCTION_SELECTOR_CHANGE=0
GRAPH_RAG_SELECTOR_CHANGE=0
TEACHING_PROJECTION=NOT_STARTED
```

ActKG 协调线程已收到精确差异，要求以新的不可变 r3 修订链修复对象范围和组件集合差；r2 包、标签和本回执全部保留，不覆盖、不删除。
