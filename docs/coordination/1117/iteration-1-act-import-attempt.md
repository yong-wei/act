# Issue #1117 Iteration 1 ACT 导入尝试记录

记录时间：2026-07-31 16:03:32 +0800

## 基线

- ACT 分支：`codex/1117-latest-aggregate-stage2-recovery`
- ACT HEAD：`4ecf9c15bb0e8082abdca30cc44b4502b6c48d86`
- `origin/integration`：`4ecf9c15bb0e8082abdca30cc44b4502b6c48d86`
- 分叉计数：`0 0`
- ActKG 协调任务：`019fb634-2bba-73f2-be87-b23b306ce3d3`

## 最新稳定 Aggregate 解析结果

- release：`control-theory-engineering-v0.7`
- releaseId：`ctr:release:control-theory-engineering-v0.7`
- releaseHash：`e46f854d7a05fd4ec840c5eaff69288e7ce34cb2119da501913cbf457ce91f8e`
- sourceDatasetHash：`21e957c750c29efaae3b7ec5d70f8155cc33221dae5faec24f3fda1d59c4f31c`
- bundleId：`ctb:control-theory-engineering-v0.7:r1`
- bundleDigest：`ad33ec039239fc89ff6d74aaa48daedab826344b84742d2a6563f6ae2a9ef1bc`
- source commit：`ef432d0faebb012b19382d71264d9b3e6a83440e`
- packaging commit：`b1287a277735af9809c6c14e6daf881b716015be`
- main verification commit：`034ee80a76a88562ada10d23f4b406f86cc0193a`
- ACT resolution digest：`91cfe889f8c5329e6c26fc146062498e1fe8157f3e7887f92da943a8c9febc7f`

冻结解析产物：

- `docs/coordination/1117/iteration-1-latest-stable-aggregate-resolution.json`
- `docs/coordination/1117/iteration-1-latest-stable-aggregate-resolution.md`

## 兼容性诊断

首次导入在任何数据库写入前被拒绝：

```text
ActKG public Bundle rejected (INTEGRITY_REJECTED):
projection version_digest mismatch: act-projection.json
```

ActKG 权威实现使用完整 Projection Profile 计算摘要。v0.7 的聚合策略为：

```text
m1i-v1e-release-tier-preserving
```

使用 ActKG `validation.py::projection_version_digest` 对 v0.7 原文件复算，结果精确等于声明值：

```text
209530336f618ff276a6830369e6c2b82b68ad5be65c3baf903a9e212b99be31
```

ACT 当前注册表只覆盖 M1E、M1F、M1G 策略，因此没有候选摘要命中。结论为 ACT 适配器缺少严格策略注册，不是上游产物损坏。已在本轮工作树加入 M1I 白名单，并增加权威测试向量与旧策略负例；未放宽摘要校验。

## 捕获修订门禁

候选导入必须把适配器、Schema 和导入内容绑定到同一个干净 ACT Git HEAD。生产导入器不得接受调用者指定另一工作树作为 `gitRoot`；该实验性入口已撤回。

M1I 适配器尚未形成通过仓库门禁的干净提交。当前 `typecheck` 被 `origin/integration` 上的既存错误阻断：

```text
src/lib/konling-conversation-library.ts(122,7): error TS2741:
Property '"teacher-diagnosis"' is missing ...
```

该文件与本轮 diff 无关。按照仓库的提交和捕获修订规则，本轮不以脏适配器或伪造 capture revision 继续导入。

数据库只读核验：

```json
{"releaseSets":0,"releases":0,"receipts":0}
```

查询条件分别绑定本轮 ReleaseSet 前缀、v0.7 releaseVersion 和 v0.7 bundleDigest。

## 验证

- latest resolver：Vitest 3/3 通过
- canonical digest：Vitest 5/5 通过
- 相关 ESLint：通过
- `git diff --check`：通过
- 8 GiB heap typecheck：失败，仅报告上述既存 `teacher-diagnosis` 缺项
- v0.7 ReleaseSet、Release、BundleReceipt：均为 0

## Iteration 1 门禁

```text
LATEST_STABLE_AGGREGATE_RESOLUTION_GATE=PASS
LATEST_BUNDLE_INTEGRITY_GATE=PASS
LATEST_BUNDLE_COMPATIBILITY_GATE=BLOCKED_PENDING_CLEAN_CAPTURE_COMMIT
LATEST_CANDIDATE_IMPORT_GATE=BLOCKED
LATEST_BUNDLE_RECEIPT_GATE=BLOCKED
OLD_CANDIDATE_IMMUTABILITY_GATE=PASS
PRODUCTION_SELECTOR_CHANGE=0
```

本轮允许的一次定向兼容修复已经用于补充 M1I 策略。Iteration 1 在干净捕获修订门禁停止；不得进入 Delta、CourseCoverage 或 Stage 2 恢复。

## 后续恢复记录

上述内容保留第一次停止时的状态。其后已完成两项独立基线修复：

- `c7516bb`：补齐 `teacher-diagnosis` 空白 hint 绑定，恢复零错误 TypeScript 基线；
- `8df1421`：登记 `m1i-v1e-release-tier-preserving`，并以权威向量验证 Projection digest。

两项提交均通过对应单元测试、ESLint、8 GiB heap typecheck、`git diff --check` 和提交门禁。

### 无效候选导入证据

在撤回外部 `--root` seam 之前，一次实验命令写入了以下候选数据：

```text
ReleaseSet=actkg-authoritative-candidate-91cfe889f8c5329e
Release=ctr:release:control-theory-engineering-v0.7
BundleReceipt=bundle-receipt:ad33ec039239fc89ff6d74aaa48daedab826344b84742d2a6563f6ae2a9ef1bc
BundleReceipt.state=ACCEPTED_CANDIDATE
captureRevision=8df14210161ce08e674f3b41553e24705be7f06c
```

该写入使用仓库外 staging root，Bundle 字节未与所声明的 ACT capture HEAD 共同受 Git 跟踪，因此不能作为成功实验结果。记录保留用于审计，不删除、不覆盖，也不作为后续 Delta、Coverage 或 Mapping 的授权输入。

### Delta 拒绝证据

随后在 `8df14210161ce08e674f3b41553e24705be7f06c` 的干净 detached capture 中计算 Delta，得到不可变拒绝回执：

```text
receiptId=delta-receipt:5f097754b1367d9e000b0a1005d9b66514015c35773030524f2bf57ed56cf8ea
algorithm=actkg-release-set-delta/1
classification=SEMANTIC_CONTENT_UPDATE
authorization=REJECTED_UPSTREAM
upstreamCrosscheckStatus=DISAGREED
outputDigest=a12e3e78b81b3469d9d167c54a3921c569d8e2febc94a13920ffa1581e8915fe
```

ACT 数据库比较的是当前已接受基线 v0.3-r2 到候选 v0.7；上游 `release-diff.json` 声明的基线是 v0.6。两者不可直接交叉验证，严格拒绝行为符合现有合同。此外，上游 Crosswalk Diff 生成器把目标总数写成 `added_count`：v0.6→v0.7 实算为新增 1361、删除 0，旧包声明为新增 5724、删除 0。

恢复路径因此调整为按 `previous_bundle` 顺序逐跳导入和计算，每跳都必须得到 `AGREED / ACCEPTED`。旧拒绝回执保持不可变，不以 `NOT_REQUIRED`、算法降级或跨版本特例绕过。

### Intake 边界修复

最新解析和 intake 工具现已执行以下失败关闭约束：

- 生产导入器固定 `root === gitRoot === process.cwd()`；
- 缺失 `previous_bundle` 时拒绝解析；
- stable tag 必须包含同路径、同字节的 `SHA256SUMS` 及其列出的每个 Bundle 成员；
- attempt output root 必须不存在，复制禁止覆盖。

定向测试 56/56 通过，ESLint、8 GiB heap typecheck 与 `git diff --check` 通过。限域复审的四项 P1 均已按代码与回归测试处理；最后一项 stable-tag 成员闭合由主线程补充负向测试验证，没有再启动第二轮全面复审。

### 当前协调阻断

ActKG `origin/main` 已出现 v0.8，动态 `LATEST_STABLE_AGGREGATE` 语义要求恢复链扩展到 v0.8。协调线程正在生成新的不可变 v0.4→v0.5→v0.6→v0.7→v0.8 修订链，并处理 v0.3-r2 所声明历史前驱的闭合证据。新链发布、独立审查及标签门禁完成前，Iteration 1 仍为 `BLOCKED_UPSTREAM_RELEASE_CHAIN`；不得进入 CourseCoverage 或 Stage 2。
