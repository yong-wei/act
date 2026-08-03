# Issue #1117 Iteration 2：r3 修订链通过与 CourseCoverage 停止证据

记录日期：2026-07-31

## 结论

ActKG r3 不可变修订链已经通过 ACT 正式 Bundle loader 与逐跳 ReleaseSet Delta 交叉校验。最新稳定端点为：

```text
ctb:control-theory-engineering-v0.8:r3
```

五个 r3 Delta 全部为 `ACCEPTED/AGREED`，且身份违规为空。随后生成了绑定 v0.8:r3 的 3,609 项 CourseCoverage 审核 worklist，但没有生成新的 CourseCoverage：当前缺少与该 worklist 摘要匹配的独立逐项审核决定；同时九角色领域复核证明两个角色不具备可合法绑定的 Canonical 知识对象。

因此本轮停止在 CourseCoverage 审核门禁，不进入 Stage 2 Binding/Mapping、handoff、Teaching Projection 或 Attestation。

## 捕获身份

```text
ACT branch=codex/1117-latest-aggregate-stage2-recovery
ACT capture revision=23b7e9420c5c0414d9240acdc0a2e166154aa6f1
ActKG branch=codex/1117-release-diff-revisions-r3
ActKG coordination HEAD=649954aad547cc7ecfe98814babbeeac2b747619
ActKG packaging commit=a479aa1105279c71cb11efad15ff18781ce1284a
resolution digest=f54ad32f66d980837af216a553e6f061c2cdb6c58e029f98bc6165367852d803
releaseSetId=actkg-authoritative-candidate-00e6a4786e4232d08a48652af8c3bd391ab9106dc0c32ef21dc633832fac3ff6
releaseId=ctr:release:control-theory-engineering-v0.8
releaseHash=caf4cf31b54675952cb65d635a29e07fa4a5729686b9875f78db3904a6497beb
sourceDatasetHash=cbd8839ba61026696e853d514b9b82fbc892804c00e418f7ede885204fe38f9b
bundleId=ctb:control-theory-engineering-v0.8:r3
bundleDigest=00e6a4786e4232d08a48652af8c3bd391ab9106dc0c32ef21dc633832fac3ff6
```

活动候选链：

```text
ctb:control-theory-engineering-v0.3:r2
→ ctb:control-theory-engineering-v0.4:r3
→ ctb:control-theory-engineering-v0.5:r3
→ ctb:control-theory-engineering-v0.6:r3
→ ctb:control-theory-engineering-v0.7:r3
→ ctb:control-theory-engineering-v0.8:r3
```

r3 Bundle、组件、Lock、冻结解析和历史根闭合工件位于：

```text
course-content/authoring/knowledge/issue-1117-v08-r3-chain/
```

五个 Lock 在干净 ACT capture revision 上逐一通过 `loadAndValidatePublicBundleV1`。

## 隔离数据库

本轮没有复用已经含有 r2 拒绝回执的 schema。新建的隔离 schema 为：

```text
issue1117_v08r3_23b7e94
```

87 个 Prisma migration 全部应用成功。由于现有 trigger function 使用未限定表名，实验连接同时设置：

```text
schema=issue1117_v08r3_23b7e94
search_path=issue1117_v08r3_23b7e94,public
```

该配置只作用于本次隔离实验连接，没有修改默认 schema、迁移或生产配置。

## 基线与逐跳 Delta

v0.2 exact 与 v0.3-r2 基线均成功导入。v0.3-r2 Delta：

```text
receipt=delta-receipt:6bdec94a7eac4c0883ef2ab03a6f36504e125bd42144bcbb0b20176112707cda
authorizationState=ACCEPTED
upstreamCrosscheckStatus=NOT_REQUIRED
```

| 跳转 | Bundle digest | Delta receipt | 授权 | 上游交叉校验 |
| --- | --- | --- | --- | --- |
| v0.3-r2 → v0.4-r3 | `1051c008525d02dcd23b851c713cc172d932f9374e7834061307abb42d3b18ee` | `delta-receipt:d414e3bf92da99afeae43558cc16299909789722b4aad7a717c45e4e95aac7c1` | ACCEPTED | AGREED |
| v0.4-r3 → v0.5-r3 | `fd1516f178bc564c2ae63f211dd69128c2c6a99510c7a6e8bcb91df02aba3d1f` | `delta-receipt:855efd7242552978520fe6a080785abce1b0b00fb2fc1366e9b6643dd60e617d` | ACCEPTED | AGREED |
| v0.5-r3 → v0.6-r3 | `ba1e2b23e9c38b85c7d67fc00322ae1029082afef9658e2e46ce6334f28b19c7` | `delta-receipt:8d401e6f9cc068d8cbf18e8aaa18fa52e380f997fec630141c19c86291f4702c` | ACCEPTED | AGREED |
| v0.6-r3 → v0.7-r3 | `b980166e0ba4cd61405b2b4c4ecd1a54e91c3d2556825b057294450d912532e5` | `delta-receipt:e68db5f48d2ce26ba91642654fb06f35308492c997b7e2f9bae864ba7a98e4ab` | ACCEPTED | AGREED |
| v0.7-r3 → v0.8-r3 | `00e6a4786e4232d08a48652af8c3bd391ab9106dc0c32ef21dc633832fac3ff6` | `delta-receipt:9f7a90209b46db0b5e1fd72559034d00ba27d4eb8b82b3e6df67ce8d6d2f1aa3` | ACCEPTED | AGREED |

六个 Delta receipt 的 `identityViolations` 均为空，capture revision 均为 `23b7e9420c5c0414d9240acdc0a2e166154aa6f1`。每次导入均报告 `defaultCandidateUnchanged=true` 与 `selectorsUnchanged=true`。

## CourseCoverage worklist

CourseCoverage 动态生成路径消费锁定的 r3 Lock，而不是把调用方参数或本地 JSON 当作 ReleaseSet authority。它先通过正式 Bundle loader 校验锁、Bundle、Manifest、Projection 与 Release，再在隔离数据库 `issue1117_v08r3_23b7e94` 中读取真实 ReleaseSet、Release、ImportReceipt、BundleReceipt 与指定 Delta receipt；连接同时设置 `schema=issue1117_v08r3_23b7e94` 和 `search_path=issue1117_v08r3_23b7e94,public`。门禁要求 ReleaseSet 为 CANDIDATE、ImportReceipt/BundleReceipt 为 ACCEPTED_CANDIDATE、Delta 为 ACCEPTED，并逐项闭合 release/hash/sourceDatasetHash/bundle/candidate evidence capture/lock raw hash/identityViolations。旧 v0.3-r2 无参数默认入口保持兼容；任何动态路径必须显式提供 `--lock`、`--delta-receipt-id` 与当前 authoring revision。

新 worklist：

```text
path=course-content/authoring/knowledge/issue-1117-v08-r3-chain/coverage-iteration-2/course-coverage-worklist.json
membershipCount=3609
itemCount=3609
inputDigest=d24df1f9acc26ccbb0c2a173e711b7fcc1902d88b5830ce8939eecf8ebe37e22
fileSha256=939bb85b46e159c89d289bc7c995dd966c7b0e32e66b6573988c2f8c0866046a
```

重复生成得到相同文件摘要。worklist 不包含最终 role 或 disposition，生成器没有制造审核结论。

动态 r3 生成命令（DATABASE_URL 仅从进程环境读取，命令和输出不打印其值）：

```bash
tsx scripts/course-coverage/review-aggregate-coverage-baseline.ts \
  --worklist-only \
  --authoring-revision 23b7e9420c5c0414d9240acdc0a2e166154aa6f1 \
  --delta-receipt-id delta-receipt:9f7a90209b46db0b5e1fd72559034d00ba27d4eb8b82b3e6df67ce8d6d2f1aa3 \
  --lock course-content/authoring/knowledge/issue-1117-v08-r3-chain/release-set.lock.v3.control-theory-engineering-v0.8-r3.json \
  --projection course-content/authoring/knowledge/issue-1117-v08-r3-chain/releases/control-theory-engineering-v0.8/act-projection.json \
  --release course-content/authoring/knowledge/issue-1117-v08-r3-chain/releases/control-theory-engineering-v0.8/release.json \
  --worklist-out course-content/authoring/knowledge/issue-1117-v08-r3-chain/coverage-iteration-2/course-coverage-worklist.json
```

错误 ReleaseSet、未知/错误 Delta、以及 v0.8 Lock 与 v0.7 Projection 混配均在写 worklist 前拒绝；未生成负向测试产物。

旧 v0.3 的 744 个 ID 仍可在新 worklist 中找到，且旧 decision 引用的 evidence ID 仍存在；这些事实只允许把旧决定作为历史检索线索。旧决定绑定旧 Release、Delta、authoring revision 与 worklist digest，不能复制为当前审核 authority。

新 worklist 中有 1,772 项只有 Canonical profile 证据。没有与新 `inputDigest` 匹配的独立逐项 reviewer decision，因此不得 assemble 新 Coverage。

## 九角色领域复核

| 角色 | 结论 |
| --- | --- |
| 反馈与闭环控制 | `VIABLE_COMPOSITE_CANDIDATE`，需人工裁定总概念与反馈特例的边界 |
| 传递函数模型 | `VIABLE_PRIMARY_CANDIDATE` |
| 时域响应与性能指标 | `VIABLE_COMPOSITE_CANDIDATE`，单一指标不能代表整组角色 |
| 根轨迹分析 | `VIABLE_PRIMARY_CANDIDATE` |
| 频域响应判读 | `VIABLE_PRIMARY_CANDIDATE` |
| 稳定裕度 | `VIABLE_COMPOSITE_CANDIDATE`，至少包含幅值裕度与相角裕度 |
| 控制器与校正 | `VIABLE_PRIMARY_CANDIDATE` |
| 仿真验证与跨模型比较 | `NO_SEMANTIC_CANDIDATE`；当前对象只覆盖仿真方法或局部指标复核，该角色属于验证/评价活动 |
| 现代控制与船海迁移 | `OUTSIDE_CURRENT_GRAPH_SCOPE`；现代控制有候选，但船海迁移是课程场景能力，不是当前 Canonical 知识对象 |

方案第 7.7 节要求：角色若本质上是活动、评价或迁移场景，必须停止并提出角色类型合同修订，不得临时绑定到近似知识节点。第八、九角色触发该停止条件。

## 验证

```text
ActKG full tests=1179 passed, 4 skipped
ACT r3 formal Bundle loader=5/5 PASS
Prisma migrate deploy=87/87 applied
ACT baseline and sequential imports=7/7 PASS
Delta authorization=6/6 ACCEPTED
r3 upstream crosscheck=5/5 AGREED
CourseCoverage worklist deterministic regeneration=PASS
CourseCoverage generator targeted Vitest=95/95 PASS
CourseCoverage generator ESLint=PASS
ACT typecheck=PASS
git diff --check=PASS
```

## 当前门禁

```text
LATEST_STABLE_AGGREGATE_RESOLUTION_GATE=PASS
LATEST_BUNDLE_INTEGRITY_GATE=PASS
LATEST_CHAIN_LOCK_GATE=PASS
LATEST_CHAIN_CLEAN_CAPTURE_GATE=PASS
LATEST_CANDIDATE_IMPORT_GATE=PASS
LATEST_DELTA_BUILD_GATE=PASS
LATEST_DELTA_ACCEPTANCE_GATE=PASS
LATEST_COURSE_COVERAGE_WORKLIST_GATE=PASS
LATEST_COURSE_COVERAGE_GATE=BLOCKED_MISSING_INDEPENDENT_REVIEW
COURSE_COVERAGE_RELEASE_ALIGNMENT_GATE=NOT_RUN
KAQ_ROLE_COVERAGE_FEASIBILITY_GATE=REJECT_ROLE_TYPE_CONTRACT
STAGE_2_GATE=NOT_RUN
HANDOFF_EXPORT_GATE=NOT_RUN
TEACHING_PROJECTION=NOT_STARTED
PRODUCTION_SELECTOR_CHANGE=0
GRAPH_RAG_SELECTOR_CHANGE=0
```

恢复继续所需的最小权威输入：

1. 由生成链外的独立 reviewer 对当前 3,609 项 worklist 逐项作出决定；
2. 对“仿真验证与跨模型比较”和“现代控制与船海迁移”修订角色类型合同，将验证/评价能力与场景迁移能力从 Canonical 知识对象 Mapping 中分离；
3. 新审核决定必须绑定当前 worklist input digest、Delta、Release 与 authoring revision。

在这三项完成前，不得生成 CURRENT/SHADOW CourseCoverage，不得进入 Stage 2 或 Teaching Projection。
